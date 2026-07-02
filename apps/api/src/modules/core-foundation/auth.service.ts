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
import { builtInRoleCodes } from "./built-in-roles";
import type { AuthSessionRecord, OrganizationRecord, PublicSession, UserRecord } from "./domain";
import type { BackendCoreContext } from "./service-context";
import { requireEnabledOrganization, requireUser } from "./store-guards";
import { toPublicOrganization, toPublicSession, toPublicUser } from "./serializers";
import type { KnownErrorCode } from "../../core/errors/error-codes";

export type OnlineUserListFilters = {
  currentOrganizationId?: string;
  userId?: string;
};

export class AuthService {
  constructor(private readonly context: BackendCoreContext) {}

  getRefreshTokenCookiePath(): string {
    return this.context.config.refreshTokenCookiePath;
  }

  getRefreshTokenCookieOptions() {
    return {
      path: this.context.config.refreshTokenCookiePath,
      sameSite: this.context.config.refreshTokenCookieSameSite,
      secure: this.context.config.refreshTokenCookieSecure,
      domain: this.context.config.refreshTokenCookieDomain
    };
  }

  async login(input: LoginRequest, request: { ipAddress?: string | null; userAgent?: string | null }) {
    const user = [...this.context.store.users.values()].find(
      (candidate) => candidate.username === input.username && !candidate.isDeleted
    );
    if (!user) throw createKnownError("AUTH_INVALID_CREDENTIALS");

    const now = nowUtc();
    this.clearExpiredTimedLock(user, now);
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
    const session = this.createSession(
      user.id,
      organizationId,
      user.tokenVersion,
      refreshTokenHash,
      request
    );
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
      refreshTokenCookie: {
        name: "refresh_token",
        httpOnly: true,
        sameSite: this.context.config.refreshTokenCookieSameSite,
        secure: this.context.config.refreshTokenCookieSecure,
        domain: this.context.config.refreshTokenCookieDomain,
        path: this.context.config.refreshTokenCookiePath,
        maxAgeSeconds: this.context.config.refreshTokenTtlDays * 24 * 60 * 60
      },
      session: toPublicSession(session),
      user: toPublicUser(user)
    };
  }

  async refreshAccessToken(refreshToken: string) {
    const tokenHash = hashToken(refreshToken, this.context.config.jwtSecret);
    const storedToken = await this.context.tokenStore.findByHash(tokenHash);
    if (!storedToken || storedToken.revokedAt) {
      throw createKnownError("AUTH_TOKEN_EXPIRED");
    }
    if (new Date(storedToken.expiresAt) <= nowUtc()) {
      const session = this.context.store.authSessions.get(storedToken.sessionId);
      if (session?.status === "active") session.status = "expired";
      throw createKnownError("AUTH_TOKEN_EXPIRED");
    }

    const user = this.context.store.users.get(storedToken.subjectId);
    if (!user || user.isDeleted) throw createKnownError("AUTH_TOKEN_INVALIDATED");
    this.clearExpiredTimedLock(user, nowUtc());
    if (user.status === "disabled") throw createKnownError("AUTH_ACCOUNT_DISABLED");
    if (user.status === "locked") throw createKnownError("AUTH_ACCOUNT_LOCKED");
    if (storedToken.tokenVersion !== user.tokenVersion) throw createKnownError("AUTH_TOKEN_INVALIDATED");

    const session = this.requireActiveSession(storedToken.sessionId, user.id);
    if (session.tokenVersion !== user.tokenVersion) throw createKnownError("AUTH_TOKEN_INVALIDATED");
    const organization = this.context.store.organizations.get(session.currentOrganizationId);
    if (!organization || organization.status !== "enabled" || organization.isDeleted) {
      throw createKnownError("BUSINESS_ORG_DISABLED");
    }
    if (!this.hasCurrentOrganizationAccess(user.id, organization.id)) {
      throw createKnownError("PERMISSION_DENIED");
    }

    session.lastSeenAt = toUtcIso(nowUtc());
    session.tokenVersion = user.tokenVersion;
    return {
      accessToken: this.signAccessToken(user, session.currentOrganizationId, session.id),
      session: toPublicSession(session)
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
    user.updatedBy = authContext.userId;
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
        this.isUsableOrganizationBinding(candidate)
    );
    if (!binding && !this.hasActiveSuperAdminBinding(user.id)) {
      throw createKnownError("PERMISSION_DENIED");
    }

    session.currentOrganizationId = organization.id;
    session.lastSeenAt = toUtcIso(nowUtc());

    return {
      accessToken: this.signAccessToken(user, organization.id, session.id),
      session: toPublicSession(session),
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
    const organizations = this.listAvailableOrganizations(user.id);

    return {
      user: toPublicUser(user),
      session: toPublicSession(session),
      currentOrganization: toPublicOrganization(currentOrganization),
      organizations,
      permissionCodes,
      menus: this.filterMenus(permissionCodes),
      passwordChangeRequired: this.isPasswordChangeRequired(user)
    };
  }

  listCurrentUserOrganizations(authContext: AuthContext) {
    const user = requireUser(this.context.store, authContext.userId);
    this.requireActiveSession(authContext.sessionId, user.id);
    return this.listAvailableOrganizations(user.id);
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
      const user = this.context.store.users.get(claims.sub);
      if (!user || user.isDeleted) throw createKnownError("AUTH_TOKEN_INVALIDATED");
      this.clearExpiredTimedLock(user, nowUtc());
      const session = this.requireActiveSession(claims.sid, user.id);
      const organization = this.context.store.organizations.get(claims.currentOrganizationId);

      if (user.status !== "enabled" || user.tokenVersion !== claims.tokenVersion) {
        throw createKnownError("AUTH_TOKEN_INVALIDATED");
      }

      if (session.tokenVersion !== user.tokenVersion) {
        throw createKnownError("AUTH_TOKEN_INVALIDATED");
      }

      if (session.currentOrganizationId !== claims.currentOrganizationId) {
        throw createKnownError("AUTH_TOKEN_INVALIDATED");
      }

      if (!organization || organization.status !== "enabled" || organization.isDeleted) {
        throw createKnownError("BUSINESS_ORG_DISABLED");
      }
      if (!this.hasCurrentOrganizationAccess(user.id, organization.id)) {
        throw createKnownError("PERMISSION_DENIED");
      }

      session.lastSeenAt = toUtcIso(nowUtc());

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
    session.status = "revoked";
    for (const refreshToken of this.context.store.refreshTokens.values()) {
      if (refreshToken.sessionId === sessionId) refreshToken.revokedAt = revokedAt;
    }
    await this.context.tokenStore.revokeBySession(sessionId);
    return toPublicSession(session);
  }

  listOnlineUsers(filters: OnlineUserListFilters = {}): PublicSession[] {
    if (filters.currentOrganizationId !== undefined && !isIntegerIdString(filters.currentOrganizationId)) {
      throw createKnownError("VALIDATION_INVALID_REQUEST");
    }
    if (filters.userId !== undefined && !isIntegerIdString(filters.userId)) {
      throw createKnownError("VALIDATION_INVALID_REQUEST");
    }

    const now = nowUtc();
    return [...this.context.store.authSessions.values()]
      .filter((session) => {
        if (session.status !== "active" || session.revokedAt) {
          return false;
        }
        if (new Date(session.expiresAt) <= now) {
          session.status = "expired";
          return false;
        }
        const user = this.context.store.users.get(session.userId);
        const organization = this.context.store.organizations.get(session.currentOrganizationId);
        return (
          user?.status === "enabled" &&
          !user.isDeleted &&
          user.tokenVersion === session.tokenVersion &&
          organization?.status === "enabled" &&
          !organization.isDeleted &&
          this.hasCurrentOrganizationAccess(user.id, organization.id)
        );
      })
      .filter(
        (session) =>
          filters.currentOrganizationId === undefined ||
          session.currentOrganizationId === filters.currentOrganizationId
      )
      .filter((session) => filters.userId === undefined || session.userId === filters.userId)
      .map(toPublicSession);
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
    tokenVersion: number,
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
      tokenVersion,
      status: "active",
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
    if (!session || session.userId !== userId || session.revokedAt || session.status !== "active") {
      throw createKnownError("AUTH_SESSION_NOT_FOUND");
    }
    if (new Date(session.expiresAt) <= nowUtc()) {
      session.status = "expired";
      throw createKnownError("AUTH_TOKEN_EXPIRED");
    }
    return session;
  }

  private filterMenus(permissionCodes: string[]) {
    return [...this.context.store.menus.values()].filter(
      (menu) =>
        !menu.isDeleted &&
        menu.status === "enabled" &&
        menu.visible &&
        this.hasEnabledRouteMetadata(menu.routeCode) &&
        (!menu.requiredPermission || permissionCodes.includes(menu.requiredPermission))
    );
  }

  private hasEnabledRouteMetadata(routeCode: string | null): boolean {
    if (routeCode === null) return true;
    return [...this.context.store.routeMetadata.values()].some(
      (route) => route.routeCode === routeCode && route.status === "enabled"
    );
  }

  private recordFailedLogin(user: UserRecord) {
    const now = nowUtc();
    user.failedLoginAttempts += 1;
    if (user.failedLoginAttempts >= this.context.config.failedLoginMaxAttempts) {
      if (user.status !== "locked") user.tokenVersion += 1;
      user.status = "locked";
      user.lockedUntil = toUtcIso(
        addSecondsUtc(now, this.context.config.failedLoginLockMinutes * 60)
      );
    }
    user.updatedAt = toUtcIso(now);
  }

  private resolveEnabledLoginOrganization(user: UserRecord): string {
    const primary = this.context.store.organizations.get(user.primaryOrganizationId);
    if (
      primary?.status === "enabled" &&
      !primary.isDeleted &&
      (this.hasActiveOrganizationBinding(user.id, primary.id) || this.hasActiveSuperAdminBinding(user.id))
    ) {
      return primary.id;
    }

    const enabledBinding = [...this.context.store.userOrganizationRoles.values()].find((binding) => {
      if (binding.userId !== user.id || !this.isUsableOrganizationBinding(binding)) return false;
      const organization = this.context.store.organizations.get(binding.organizationId);
      return organization?.status === "enabled" && !organization.isDeleted;
    });
    if (!enabledBinding && this.hasActiveSuperAdminBinding(user.id)) {
      const enabledOrganization = [...this.context.store.organizations.values()].find(
        isEnabledOrganization
      );
      if (enabledOrganization) return enabledOrganization.id;
    }
    if (!enabledBinding) throw createKnownError("BUSINESS_NO_ENABLED_ORGANIZATION");
    return enabledBinding.organizationId;
  }

  private hasActiveOrganizationBinding(userId: string, organizationId: string): boolean {
    return [...this.context.store.userOrganizationRoles.values()].some(
      (binding) =>
        binding.userId === userId &&
        binding.organizationId === organizationId &&
        this.isUsableOrganizationBinding(binding)
    );
  }

  private hasCurrentOrganizationAccess(userId: string, organizationId: string): boolean {
    return (
      this.hasActiveOrganizationBinding(userId, organizationId) ||
      this.hasActiveSuperAdminBinding(userId)
    );
  }

  private listAvailableOrganizations(userId: string) {
    if (this.hasActiveSuperAdminBinding(userId)) {
      return [...this.context.store.organizations.values()]
        .filter(isEnabledOrganization)
        .map((organization) => toPublicOrganization(organization));
    }

    const organizationIds = new Set<string>();
    return [...this.context.store.userOrganizationRoles.values()]
      .filter((binding) => binding.userId === userId && this.isUsableOrganizationBinding(binding))
      .map((binding) => this.context.store.organizations.get(binding.organizationId))
      .filter(isEnabledOrganization)
      .filter((organization) => {
        if (organizationIds.has(organization.id)) return false;
        organizationIds.add(organization.id);
        return true;
      })
      .map((organization) => toPublicOrganization(organization));
  }

  private hasActiveSuperAdminBinding(userId: string): boolean {
    return [...this.context.store.userOrganizationRoles.values()].some((binding) => {
      if (binding.userId !== userId || !isActiveBinding(binding)) return false;
      const role = this.context.store.roles.get(binding.roleId);
      return role?.code === builtInRoleCodes.superAdmin && role.status === "enabled" && !role.isDeleted;
    });
  }

  private isUsableOrganizationBinding(
    binding: { isDeleted: boolean; status: "enabled" | "disabled"; roleId: string }
  ): boolean {
    if (!isActiveBinding(binding)) return false;
    const role = this.context.store.roles.get(binding.roleId);
    return role?.status === "enabled" && !role.isDeleted;
  }

  private isPasswordChangeRequired(user: UserRecord): boolean {
    if (user.firstLoginPasswordChangeRequired) return true;
    return user.passwordExpiresAt !== null && new Date(user.passwordExpiresAt) <= nowUtc();
  }

  private isUserLocked(user: UserRecord, now: Date): boolean {
    if (user.status !== "locked") return false;
    return !user.lockedUntil || new Date(user.lockedUntil) > now;
  }

  private clearExpiredTimedLock(user: UserRecord, now: Date): void {
    if (user.status !== "locked" || !user.lockedUntil || new Date(user.lockedUntil) > now) return;
    user.status = "enabled";
    user.lockedUntil = null;
    user.failedLoginAttempts = 0;
    user.updatedAt = toUtcIso(now);
  }
}

function isEnabledOrganization(
  organization: OrganizationRecord | undefined
): organization is OrganizationRecord {
  return organization?.status === "enabled" && !organization.isDeleted;
}

function isActiveBinding(binding: { isDeleted: boolean; status: "enabled" | "disabled" }) {
  return !binding.isDeleted && binding.status === "enabled";
}

function isIntegerIdString(value: string): boolean {
  return /^[1-9]\d*$/.test(value);
}
