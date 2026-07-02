import {
  type ChangePasswordRequest,
  type LoginRequest,
  type SwitchCurrentOrganizationRequest
} from "@web-admin-base/contracts";

import type { AuthContext } from "../../core/auth-context/auth-context";
import { createKnownError } from "../../core/errors/error-codes";
import { addDaysUtc, addSecondsUtc, nowUtc, toUtcIso } from "../../core/time/utc";
import {
  createRefreshToken,
  hashToken,
  signAccessToken,
  verifyAccessToken
} from "../../infra/security/jwt";
import { hashPassword, verifyPassword } from "../../infra/security/password-hash";
import {
  validatePasswordComplexity
} from "../../infra/security/password-policy";
import type { AuthSessionRecord, OrganizationRecord, PublicSession, UserRecord } from "./domain";
import type { BackendCoreContext } from "./service-context";
import { requireEnabledOrganization, requireUser } from "./store-guards";
import { toPublicOrganization, toPublicUser } from "./serializers";
import type { KnownErrorCode } from "../../core/errors/error-codes";

export class AuthService {
  constructor(private readonly context: BackendCoreContext) {}

  async login(input: LoginRequest, request: { ipAddress?: string | null; userAgent?: string | null }) {
    const user = [...this.context.store.users.values()].find(
      (candidate) => candidate.username === input.username && !candidate.isDeleted
    );
    if (!user) throw createKnownError("AUTH_INVALID_CREDENTIALS");

    const now = nowUtc();
    if (user.status === "disabled" || user.isDeleted) throw createKnownError("AUTH_ACCOUNT_DISABLED");
    if (this.isUserLocked(user, now)) {
      throw createKnownError("AUTH_ACCOUNT_LOCKED");
    }

    if (!(await verifyPassword(input.password, user.passwordHash))) {
      this.recordFailedLogin(user);
      throw createKnownError("AUTH_INVALID_CREDENTIALS");
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
    const refreshTokenRecord = {
      id: refreshTokenId,
      tenantId: null,
      sessionId: session.id,
      userId: user.id,
      tokenHash: refreshTokenHash,
      tokenVersion: user.tokenVersion,
      expiresAt: session.expiresAt,
      revokedAt: null,
      createdAt: session.createdAt
    };
    this.context.store.refreshTokens.set(refreshTokenId, refreshTokenRecord);
    await this.context.tokenStore.store({
      tokenHash: refreshTokenHash,
      subjectId: user.id,
      sessionId: session.id,
      tokenVersion: user.tokenVersion,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      revokedAt: null
    });

    return {
      accessToken: this.signAccessToken(user, organizationId, session.id),
      refreshToken,
      refreshTokenCookie: { name: "refresh_token", httpOnly: true, sameSite: "Strict" as const },
      session,
      user: toPublicUser(user)
    };
  }

  async refreshAccessToken(refreshToken: string) {
    const tokenHash = hashToken(refreshToken, this.context.config.jwtSecret);
    const storedToken = await this.context.tokenStore.findByHash(tokenHash);
    if (!storedToken || storedToken.revokedAt || new Date(storedToken.expiresAt) <= nowUtc()) {
      throw createKnownError("AUTH_TOKEN_EXPIRED");
    }

    const user = requireUser(this.context.store, storedToken.subjectId);
    if (storedToken.tokenVersion !== user.tokenVersion) throw createKnownError("AUTH_TOKEN_INVALIDATED");
    if (user.status === "disabled") throw createKnownError("AUTH_ACCOUNT_DISABLED");
    if (user.status === "locked") throw createKnownError("AUTH_ACCOUNT_LOCKED");

    const session = this.context.store.authSessions.get(storedToken.sessionId);
    if (!session || session.revokedAt) throw createKnownError("AUTH_SESSION_NOT_FOUND");
    requireEnabledOrganization(this.context.store, session.currentOrganizationId);

    session.lastSeenAt = toUtcIso(nowUtc());
    return {
      accessToken: this.signAccessToken(user, session.currentOrganizationId, session.id),
      session
    };
  }

  findAuthContext(authorizationHeader?: string | null): AuthContext | null {
    if (!authorizationHeader?.startsWith("Bearer ")) return null;
    return this.authenticateAccessToken(authorizationHeader.slice("Bearer ".length));
  }

  async changePassword(authContext: AuthContext, input: ChangePasswordRequest) {
    const user = requireUser(this.context.store, authContext.userId);
    if (!(await verifyPassword(input.oldPassword, user.passwordHash))) {
      throw createKnownError("AUTH_INVALID_CREDENTIALS");
    }

    const result = validatePasswordComplexity(input.newPassword, this.context.config.passwordPolicy);
    if (!result.valid) {
      throw createKnownError((result.reasons[0] ?? "VALIDATION_PASSWORD_POLICY") as KnownErrorCode);
    }

    const now = nowUtc();
    user.passwordHash = await hashPassword(input.newPassword);
    user.passwordChangedAt = toUtcIso(now);
    user.passwordExpiresAt = toUtcIso(
      addDaysUtc(now, this.context.config.passwordPolicy.periodicChangeDays)
    );
    user.firstLoginPasswordChangeRequired = false;
    user.tokenVersion += 1;
    user.updatedAt = toUtcIso(now);
    return toPublicUser(user);
  }

  async switchCurrentOrganization(
    authContext: AuthContext,
    input: SwitchCurrentOrganizationRequest,
    permissionCodes: string[]
  ) {
    const user = requireUser(this.context.store, authContext.userId);
    const organization = requireEnabledOrganization(this.context.store, input.organizationId);
    const session = this.requireActiveSession(authContext.sessionId, user.id);
    const binding = [...this.context.store.userOrganizationRoles.values()].find(
      (candidate) =>
        candidate.userId === user.id &&
        candidate.organizationId === input.organizationId &&
        !candidate.isDeleted
    );
    if (!binding) throw createKnownError("PERMISSION_DENIED");

    session.currentOrganizationId = organization.id;
    session.lastSeenAt = toUtcIso(nowUtc());

    return {
      accessToken: this.signAccessToken(user, organization.id, session.id),
      session,
      currentOrganization: toPublicOrganization(organization),
      permissionCodes,
      menus: this.filterMenus(permissionCodes)
    };
  }

  getCurrentUserContext(authContext: AuthContext, permissionCodes: string[]) {
    const user = requireUser(this.context.store, authContext.userId);
    const session = this.requireActiveSession(authContext.sessionId, user.id);
    const currentOrganization = requireEnabledOrganization(
      this.context.store,
      authContext.currentOrganizationId
    );
    const organizations = [...this.context.store.userOrganizationRoles.values()]
      .filter((binding) => binding.userId === user.id && !binding.isDeleted)
      .map((binding) => this.context.store.organizations.get(binding.organizationId))
      .filter(isEnabledOrganization)
      .map((organization) => toPublicOrganization(organization));

    return {
      user: toPublicUser(user),
      session,
      currentOrganization: toPublicOrganization(currentOrganization),
      organizations,
      permissionCodes,
      menus: this.filterMenus(permissionCodes),
      passwordChangeRequired: this.isPasswordChangeRequired(user)
    };
  }

  getCurrentPermissionContext(authContext: AuthContext, permissionCodes: string[]) {
    const user = requireUser(this.context.store, authContext.userId);
    this.requireActiveSession(authContext.sessionId, user.id);
    const currentOrganization = requireEnabledOrganization(
      this.context.store,
      authContext.currentOrganizationId
    );

    return {
      currentOrganization: toPublicOrganization(currentOrganization),
      permissionCodes,
      menus: this.filterMenus(permissionCodes)
    };
  }

  authenticateAccessToken(accessToken: string): AuthContext {
    try {
      const claims = verifyAccessToken(accessToken, {
        secret: this.context.config.jwtSecret,
        issuer: this.context.config.jwtIssuer
      });
      const user = requireUser(this.context.store, claims.sub);
      const session = this.requireActiveSession(claims.sid, user.id);
      const organization = this.context.store.organizations.get(claims.currentOrganizationId);

      if (user.status !== "enabled" || user.tokenVersion !== claims.tokenVersion) {
        throw createKnownError("AUTH_TOKEN_INVALIDATED");
      }

      if (session.currentOrganizationId !== claims.currentOrganizationId) {
        throw createKnownError("AUTH_TOKEN_INVALIDATED");
      }

      if (!organization || organization.status !== "enabled" || organization.isDeleted) {
        throw createKnownError("BUSINESS_ORG_DISABLED");
      }

      return {
        userId: user.id,
        sessionId: claims.sid,
        username: user.username,
        currentOrganizationId: claims.currentOrganizationId,
        tokenVersion: claims.tokenVersion,
        passwordChangeRequired: this.isPasswordChangeRequired(user)
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AppError") throw error;
      throw createKnownError("AUTH_TOKEN_EXPIRED");
    }
  }

  async logout(sessionId: string) {
    const session = this.context.store.authSessions.get(sessionId);
    if (!session) throw createKnownError("AUTH_SESSION_NOT_FOUND");

    const revokedAt = toUtcIso(nowUtc());
    session.revokedAt = revokedAt;
    for (const refreshToken of this.context.store.refreshTokens.values()) {
      if (refreshToken.sessionId === sessionId) refreshToken.revokedAt = revokedAt;
    }
    await this.context.tokenStore.revokeBySession(sessionId);
    return session;
  }

  listOnlineUsers(): PublicSession[] {
    const now = nowUtc();
    return [...this.context.store.authSessions.values()].filter(
      (session) => !session.revokedAt && new Date(session.expiresAt) > now
    );
  }

  private signAccessToken(user: UserRecord, organizationId: string, sessionId: string): string {
    const issuedAt = Math.floor(Date.now() / 1000);
    return signAccessToken(
      {
        sub: user.id,
        sid: sessionId,
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

  private requireActiveSession(sessionId: string, userId: string): AuthSessionRecord {
    const session = this.context.store.authSessions.get(sessionId);
    if (!session || session.userId !== userId || session.revokedAt) {
      throw createKnownError("AUTH_SESSION_NOT_FOUND");
    }
    if (new Date(session.expiresAt) <= nowUtc()) throw createKnownError("AUTH_TOKEN_EXPIRED");
    return session;
  }

  private filterMenus(permissionCodes: string[]) {
    return [...this.context.store.menus.values()].filter(
      (menu) =>
        !menu.isDeleted &&
        menu.status === "enabled" &&
        (!menu.requiredPermission || permissionCodes.includes(menu.requiredPermission))
    );
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
      if (binding.userId !== user.id || binding.isDeleted) return false;
      const organization = this.context.store.organizations.get(binding.organizationId);
      return organization?.status === "enabled" && !organization.isDeleted;
    });
    if (!enabledBinding) throw createKnownError("BUSINESS_NO_ENABLED_ORGANIZATION");
    return enabledBinding.organizationId;
  }

  private isPasswordChangeRequired(user: UserRecord): boolean {
    if (user.firstLoginPasswordChangeRequired) return true;
    return user.passwordExpiresAt !== null && new Date(user.passwordExpiresAt) <= nowUtc();
  }

  private isUserLocked(user: UserRecord, now: Date): boolean {
    if (user.status !== "locked") return false;
    return !user.lockedUntil || new Date(user.lockedUntil) > now;
  }
}

function isEnabledOrganization(
  organization: OrganizationRecord | undefined
): organization is OrganizationRecord {
  return organization?.status === "enabled" && !organization.isDeleted;
}
