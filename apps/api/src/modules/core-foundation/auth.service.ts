import type { LoginRequest } from "@web-admin-base/contracts";

import { addDaysUtc, addSecondsUtc, nowUtc, toUtcIso } from "../../core/time/utc";
import { createRefreshToken, hashToken, signAccessToken } from "../../infra/security/jwt";
import { verifyPassword } from "../../infra/security/password-hash";
import type { AuthSessionRecord, PublicSession, UserRecord } from "./domain";
import type { BackendCoreContext } from "./service-context";
import { requireUser } from "./store-guards";
import { toPublicUser } from "./serializers";

export class AuthService {
  constructor(private readonly context: BackendCoreContext) {}

  async login(input: LoginRequest, request: { ipAddress?: string | null; userAgent?: string | null }) {
    const user = [...this.context.store.users.values()].find(
      (candidate) => candidate.username === input.username && !candidate.isDeleted
    );
    if (!user) throw new Error("AUTH_INVALID_CREDENTIALS");

    const now = nowUtc();
    if (user.status === "disabled" || user.isDeleted) throw new Error("AUTH_ACCOUNT_DISABLED");
    if (user.status === "locked" && user.lockedUntil && new Date(user.lockedUntil) > now) {
      throw new Error("AUTH_ACCOUNT_LOCKED");
    }

    if (!(await verifyPassword(input.password, user.passwordHash))) {
      this.recordFailedLogin(user);
      throw new Error("AUTH_INVALID_CREDENTIALS");
    }

    const organizationId = this.resolveEnabledLoginOrganization(user);
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    user.status = "enabled";
    user.lastLoginAt = toUtcIso(now);
    user.updatedAt = toUtcIso(now);

    const refreshToken = createRefreshToken();
    const refreshTokenHash = hashToken(refreshToken, this.context.config.jwtSecret);
    const session = this.createSession(user.id, organizationId, refreshTokenHash, request);
    const refreshTokenId = this.context.store.nextId("refreshToken");
    this.context.store.refreshTokens.set(refreshTokenId, {
      id: refreshTokenId,
      tenantId: null,
      sessionId: session.id,
      userId: user.id,
      tokenHash: refreshTokenHash,
      tokenVersion: user.tokenVersion,
      expiresAt: session.expiresAt,
      revokedAt: null,
      createdAt: session.createdAt
    });

    return {
      accessToken: this.signAccessToken(user, organizationId),
      refreshToken,
      refreshTokenCookie: { name: "refresh_token", httpOnly: true, sameSite: "Strict" as const },
      session,
      user: toPublicUser(user)
    };
  }

  refreshAccessToken(refreshToken: string) {
    const tokenHash = hashToken(refreshToken, this.context.config.jwtSecret);
    const storedToken = [...this.context.store.refreshTokens.values()].find(
      (candidate) => candidate.tokenHash === tokenHash
    );
    if (!storedToken || storedToken.revokedAt || new Date(storedToken.expiresAt) <= nowUtc()) {
      throw new Error("AUTH_TOKEN_EXPIRED");
    }

    const user = requireUser(this.context.store, storedToken.userId);
    if (storedToken.tokenVersion !== user.tokenVersion) throw new Error("AUTH_TOKEN_INVALIDATED");

    const session = this.context.store.authSessions.get(storedToken.sessionId);
    if (!session || session.revokedAt) throw new Error("AUTH_SESSION_NOT_FOUND");

    session.lastSeenAt = toUtcIso(nowUtc());
    return { accessToken: this.signAccessToken(user, session.currentOrganizationId), session };
  }

  logout(sessionId: string) {
    const session = this.context.store.authSessions.get(sessionId);
    if (!session) throw new Error("AUTH_SESSION_NOT_FOUND");

    const revokedAt = toUtcIso(nowUtc());
    session.revokedAt = revokedAt;
    for (const refreshToken of this.context.store.refreshTokens.values()) {
      if (refreshToken.sessionId === sessionId) refreshToken.revokedAt = revokedAt;
    }
    return session;
  }

  listOnlineUsers(): PublicSession[] {
    const now = nowUtc();
    return [...this.context.store.authSessions.values()].filter(
      (session) => !session.revokedAt && new Date(session.expiresAt) > now
    );
  }

  private signAccessToken(user: UserRecord, organizationId: string): string {
    const issuedAt = Math.floor(Date.now() / 1000);
    return signAccessToken(
      {
        sub: user.id,
        username: user.username,
        currentOrganizationId: organizationId,
        tokenVersion: user.tokenVersion,
        iat: issuedAt,
        exp: issuedAt + this.context.config.accessTokenTtlSeconds
      },
      { secret: this.context.config.jwtSecret, issuer: this.context.config.jwtIssuer }
    );
  }

  private createSession(
    userId: string,
    organizationId: string,
    refreshTokenHash: string,
    request: { ipAddress?: string | null; userAgent?: string | null }
  ): AuthSessionRecord {
    const now = nowUtc();
    const session: AuthSessionRecord = {
      id: this.context.store.nextId("authSession"),
      tenantId: null,
      userId,
      refreshTokenHash,
      currentOrganizationId: organizationId,
      ipAddress: request.ipAddress ?? null,
      userAgent: request.userAgent ?? null,
      expiresAt: toUtcIso(addDaysUtc(now, this.context.config.refreshTokenTtlDays)),
      revokedAt: null,
      createdAt: toUtcIso(now),
      lastSeenAt: toUtcIso(now)
    };
    this.context.store.authSessions.set(session.id, session);
    return session;
  }

  private recordFailedLogin(user: UserRecord) {
    user.failedLoginAttempts += 1;
    if (user.failedLoginAttempts >= this.context.config.failedLoginMaxAttempts) {
      user.status = "locked";
      user.lockedUntil = toUtcIso(
        addSecondsUtc(nowUtc(), this.context.config.failedLoginLockMinutes * 60)
      );
    }
  }

  private resolveEnabledLoginOrganization(user: UserRecord): string {
    const primary = this.context.store.organizations.get(user.primaryOrganizationId);
    if (primary?.status === "enabled" && !primary.isDeleted) return primary.id;

    const enabledBinding = [...this.context.store.userOrganizationRoles.values()].find((binding) => {
      if (binding.userId !== user.id) return false;
      const organization = this.context.store.organizations.get(binding.organizationId);
      return organization?.status === "enabled" && !organization.isDeleted;
    });
    if (!enabledBinding) throw new Error("BUSINESS_NO_ENABLED_ORGANIZATION");
    return enabledBinding.organizationId;
  }
}
