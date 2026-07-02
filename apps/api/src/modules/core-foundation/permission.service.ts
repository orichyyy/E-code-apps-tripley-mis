import {
  baseApiPermissionManifest,
  basePermissionManifest,
  type BaseApiPermissionManifestEntry,
  type PermissionManifestEntry
} from "@web-admin-base/contracts";
import { createHash } from "node:crypto";

import type { AuthContext } from "../../core/auth-context/auth-context";
import { createKnownError } from "../../core/errors/error-codes";
import { nowUtc, toUtcIso } from "../../core/time/utc";
import { PermissionCache } from "../permissions/permission-cache";
import { builtInRoleCodes } from "./built-in-roles";
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
    const userIds = new Set(
      [...this.context.store.userOrganizationRoles.values()]
        .filter((binding) => binding.roleId === roleId)
        .map((binding) => binding.userId)
    );
    await Promise.all([...userIds].map((userId) => this.invalidateUser(userId)));
  }

  async invalidateUser(userId: string) {
    const bindings = [...this.context.store.userOrganizationRoles.values()].filter(
      (binding) => binding.userId === userId
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
      const manifestHash = hashBasePermissionManifestEntry(entry);
      const { resource, action } = parsePermissionCode(entry.code);
      const existing = [...this.context.store.permissions.values()].find(
        (permission) => permission.code === entry.code
      );
      if (existing) {
        existing.name = entry.code;
        existing.resource = resource;
        existing.action = action;
        existing.description = entry.description;
        existing.module = entry.module;
        existing.source = "base_manifest";
        existing.manifestHash = manifestHash;
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
        resource,
        action,
        description: entry.description,
        module: entry.module,
        source: "base_manifest",
        manifestHash,
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

    const isSuperAdmin = this.hasActiveSuperAdminBinding(userId);
    const binding = [...this.context.store.userOrganizationRoles.values()].find(
      (candidate) =>
        candidate.userId === userId &&
        candidate.organizationId === organizationId &&
        isActiveBinding(candidate)
    );
    const role = binding ? this.context.store.roles.get(binding.roleId) : null;
    const permissionCodes = isSuperAdmin
      ? this.listEnabledPermissionCodes()
      : this.listRolePermissionCodes(binding?.roleId, role ?? null);
    const context = { userId, organizationId, permissionCodes };
    await this.cache.set(context);
    return context;
  }

  private hasActiveSuperAdminBinding(userId: string): boolean {
    return [...this.context.store.userOrganizationRoles.values()].some((binding) => {
      if (binding.userId !== userId || !isActiveBinding(binding)) return false;
      const role = this.context.store.roles.get(binding.roleId);
      return role?.code === builtInRoleCodes.superAdmin && role.status === "enabled" && !role.isDeleted;
    });
  }

  private listEnabledPermissionCodes(): string[] {
    return [...this.context.store.permissions.values()]
      .filter((permission) => permission.status === "enabled")
      .map((permission) => permission.code);
  }

  private listRolePermissionCodes(
    roleId: string | undefined,
    role: { status: "enabled" | "disabled"; isDeleted: boolean } | null
  ): string[] {
    if (!roleId || role?.status !== "enabled" || role.isDeleted) return [];
    return this.context.store.rolePermissions
      .filter((permission) => permission.roleId === roleId && permission.effect === "allow")
      .map((permission) => permission.permissionCode);
  }
}

function isActiveBinding(binding: { isDeleted: boolean; status: "enabled" | "disabled" }) {
  return !binding.isDeleted && binding.status === "enabled";
}

function isPasswordLifecycleRoute(apiPermissionCode: string): boolean {
  return (
    apiPermissionCode === "api.auth.me" ||
    apiPermissionCode === "api.auth.change-password" ||
    apiPermissionCode === "api.auth.logout"
  );
}

function hashBasePermissionManifestEntry(entry: PermissionManifestEntry): string {
  return createHash("sha256")
    .update(JSON.stringify({
      code: entry.code,
      description: entry.description,
      module: entry.module
    }))
    .digest("hex");
}

function parsePermissionCode(code: string): { resource: string; action: string } {
  const separatorIndex = code.indexOf(":");
  if (separatorIndex === -1) return { resource: code, action: "" };
  return {
    resource: code.slice(0, separatorIndex),
    action: code.slice(separatorIndex + 1)
  };
}
