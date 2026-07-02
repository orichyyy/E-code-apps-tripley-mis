import {
  baseApiPermissionManifest,
  basePermissionManifest,
  type BaseApiPermissionManifestEntry
} from "@web-admin-base/contracts";

import type { AuthContext } from "../../core/auth-context/auth-context";
import { createKnownError } from "../../core/errors/error-codes";
import { nowUtc, toUtcIso } from "../../core/time/utc";
import { PermissionCache } from "../permissions/permission-cache";
import type { ApiPermissionRecord, PermissionRecord } from "./domain";
import type { BackendCoreContext } from "./service-context";

export class PermissionService {
  constructor(
    private readonly context: BackendCoreContext,
    private readonly cache: PermissionCache
  ) {}

  async requireApiPermission(
    authContext: AuthContext | null,
    apiPermission: BaseApiPermissionManifestEntry
  ) {
    if (apiPermission.public) return;
    if (!authContext) throw createKnownError("AUTH_TOKEN_EXPIRED");
    if (authContext.passwordChangeRequired && !isPasswordLifecycleRoute(apiPermission.code)) {
      throw createKnownError("AUTH_PASSWORD_CHANGE_REQUIRED");
    }
    if (!apiPermission.requiredPermission) return;

    const permissionContext = await this.getPermissionContext(
      authContext.userId,
      authContext.currentOrganizationId
    );
    if (!permissionContext.permissionCodes.includes(apiPermission.requiredPermission)) {
      throw createKnownError("PERMISSION_API_DENIED");
    }
  }

  async invalidateRole(roleId: string) {
    const bindings = [...this.context.store.userOrganizationRoles.values()].filter(
      (binding) => binding.roleId === roleId && !binding.isDeleted
    );
    await Promise.all(
      bindings.map((binding) => this.cache.invalidate(binding.userId, binding.organizationId))
    );
  }

  async invalidateUserOrganization(userId: string, organizationId: string) {
    await this.cache.invalidate(userId, organizationId);
  }

  async invalidateAllPermissionContexts() {
    await Promise.all(
      [...this.context.store.userOrganizationRoles.values()]
        .filter((binding) => !binding.isDeleted)
        .map((binding) => this.cache.invalidate(binding.userId, binding.organizationId))
    );
  }

  async syncPermissionManifests() {
    const permissions = this.syncBasePermissions();
    const apiPermissions = this.syncBaseApiPermissions();
    await this.invalidateAllPermissionContexts();
    return {
      permissions,
      apiPermissions
    };
  }

  listPermissions(): PermissionRecord[] {
    return [...this.context.store.permissions.values()];
  }

  listApiPermissions(): ApiPermissionRecord[] {
    return [...this.context.store.apiPermissions.values()];
  }

  syncBasePermissions(): PermissionRecord[] {
    const now = toUtcIso(nowUtc());
    return basePermissionManifest.map((entry) => {
      const existing = [...this.context.store.permissions.values()].find(
        (permission) => permission.code === entry.code
      );
      if (existing) {
        existing.name = entry.code;
        existing.description = entry.description;
        existing.module = entry.module;
        existing.status = "enabled";
        existing.updatedAt = now;
        return existing;
      }

      const permission: PermissionRecord = {
        id: this.context.store.nextId("permission"),
        tenantId: null,
        code: entry.code,
        name: entry.code,
        permissionType: "action",
        description: entry.description,
        module: entry.module,
        status: "enabled",
        createdAt: now,
        updatedAt: now
      };
      this.context.store.permissions.set(permission.id, permission);
      return permission;
    });
  }

  syncBaseApiPermissions(): ApiPermissionRecord[] {
    const now = toUtcIso(nowUtc());
    return baseApiPermissionManifest.map((entry) => {
      const existing = [...this.context.store.apiPermissions.values()].find(
        (permission) => permission.code === entry.code
      );
      if (existing) {
        existing.method = entry.method;
        existing.path = entry.path;
        existing.description = entry.description;
        existing.module = entry.module;
        existing.requiredPermission = entry.requiredPermission ?? null;
        existing.logLevel = entry.logLevel;
        existing.public = entry.public;
        existing.status = "enabled";
        existing.updatedAt = now;
        return existing;
      }

      const apiPermission: ApiPermissionRecord = {
        id: this.context.store.nextId("apiPermission"),
        tenantId: null,
        method: entry.method,
        path: entry.path,
        code: entry.code,
        description: entry.description,
        module: entry.module,
        requiredPermission: entry.requiredPermission ?? null,
        logLevel: entry.logLevel,
        public: entry.public,
        status: "enabled",
        createdAt: now,
        updatedAt: now
      };
      this.context.store.apiPermissions.set(apiPermission.id, apiPermission);
      return apiPermission;
    });
  }

  async getPermissionContext(userId: string, organizationId: string) {
    const cached = await this.cache.get(userId, organizationId);
    if (cached) return cached;

    const binding = [...this.context.store.userOrganizationRoles.values()].find(
      (candidate) =>
        candidate.userId === userId &&
        candidate.organizationId === organizationId &&
        !candidate.isDeleted
    );
    const role = binding ? this.context.store.roles.get(binding.roleId) : null;
    const permissionCodes = binding && role?.status === "enabled" && !role.isDeleted
      ? this.context.store.rolePermissions
          .filter((permission) => permission.roleId === binding.roleId)
          .map((permission) => permission.permissionCode)
      : [];
    const context = { userId, organizationId, permissionCodes };
    await this.cache.set(context);
    return context;
  }
}

function isPasswordLifecycleRoute(apiPermissionCode: string): boolean {
  return (
    apiPermissionCode === "api.auth.me" ||
    apiPermissionCode === "api.auth.change-password" ||
    apiPermissionCode === "api.auth.logout"
  );
}
