import {
  baseApiPermissionManifest,
  basePermissionManifest,
  type BaseApiPermissionManifestEntry
} from "@web-admin-base/contracts";

import type { AuthContext } from "../../core/auth-context/auth-context";
import { createKnownError } from "../../core/errors/error-codes";
import { PermissionCache } from "../permissions/permission-cache";
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
      (binding) => binding.roleId === roleId
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
      [...this.context.store.userOrganizationRoles.values()].map((binding) =>
        this.cache.invalidate(binding.userId, binding.organizationId)
      )
    );
  }

  async syncPermissionManifests() {
    await this.invalidateAllPermissionContexts();
    return {
      permissions: basePermissionManifest,
      apiPermissions: baseApiPermissionManifest
    };
  }

  async getPermissionContext(userId: string, organizationId: string) {
    const cached = await this.cache.get(userId, organizationId);
    if (cached) return cached;

    const binding = [...this.context.store.userOrganizationRoles.values()].find(
      (candidate) => candidate.userId === userId && candidate.organizationId === organizationId
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
