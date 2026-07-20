import {
  baseApiPermissionManifest,
  basePermissionManifest,
  type BaseApiPermissionManifestEntry,
  type PermissionManifestEntry,
} from "@web-admin-base/contracts";
import { createHash } from "node:crypto";

import type { AuthContext } from "../../core/auth-context/auth-context";
import { createKnownError } from "../../core/errors/error-codes";
import { nowUtc, toUtcIso } from "../../core/time/utc";
import { PermissionCache } from "../permissions/permission-cache";
import { builtInRoleCodes } from "./built-in-roles";
import type { ApiPermissionRecord, PermissionRecord } from "./domain";
import type { BackendCoreContext } from "./service-context";
import { requireIntegerIdString } from "./store-guards";

export type ApiPermissionListFilters = {
  keyword?: string;
  logLevel?: ApiPermissionRecord["logLevel"];
  method?: string;
  module?: string;
  public?: boolean;
  status?: ApiPermissionRecord["status"];
};

export type PermissionListFilters = {
  action?: string;
  keyword?: string;
  module?: string;
  permissionType?: PermissionRecord["permissionType"];
  resource?: string;
  source?: string;
  status?: PermissionRecord["status"];
};

export type PermissionTreeNode = {
  key: string;
  label: string;
  level: "module" | "resource" | "action";
  module: string;
  resource?: string;
  action?: string;
  permissions: PermissionRecord[];
  children: PermissionTreeNode[];
};

export class PermissionService {
  constructor(
    private readonly context: BackendCoreContext,
    private readonly cache: PermissionCache,
  ) {}

  async requireApiPermission(
    authContext: AuthContext | null,
    apiPermission: BaseApiPermissionManifestEntry,
  ) {
    if (apiPermission.public) return;
    if (!authContext) throw createKnownError("AUTH_TOKEN_EXPIRED");
    if (authContext.passwordChangeRequired && !isPasswordLifecycleRoute(apiPermission.code)) {
      throw createKnownError("AUTH_PASSWORD_CHANGE_REQUIRED");
    }
    if (!apiPermission.requiredPermission) return;

    const permissionContext = await this.getPermissionContext(
      authContext.userId,
      authContext.currentOrganizationId,
    );
    if (!permissionContext.permissionCodes.includes(apiPermission.requiredPermission)) {
      throw createKnownError("PERMISSION_API_DENIED");
    }
  }

  async invalidateRole(roleId: string) {
    const userIds = new Set(
      [...this.context.store.userOrganizationRoles.values()]
        .filter((binding) => binding.roleId === roleId)
        .map((binding) => binding.userId),
    );
    await Promise.all([...userIds].map((userId) => this.invalidateUser(userId)));
  }

  async invalidateUser(userId: string) {
    const organizationIds = new Set<string>();
    for (const binding of this.context.store.userOrganizationRoles.values()) {
      if (binding.userId === userId) organizationIds.add(binding.organizationId);
    }
    for (const organization of this.context.store.organizations.values()) {
      if (!organization.isDeleted) organizationIds.add(organization.id);
    }
    await Promise.all(
      [...organizationIds].map((organizationId) => this.cache.invalidate(userId, organizationId)),
    );
  }

  async invalidateUserOrganization(userId: string, organizationId: string) {
    await this.cache.invalidate(userId, organizationId);
  }

  async invalidateAllPermissionContexts() {
    const userIds = new Set<string>();
    const organizationIds = new Set<string>();

    for (const user of this.context.store.users.values()) {
      if (!user.isDeleted) userIds.add(user.id);
    }
    for (const organization of this.context.store.organizations.values()) {
      if (!organization.isDeleted) organizationIds.add(organization.id);
    }
    for (const binding of this.context.store.userOrganizationRoles.values()) {
      if (binding.isDeleted) continue;
      userIds.add(binding.userId);
      organizationIds.add(binding.organizationId);
    }

    await Promise.all(
      [...userIds].flatMap((userId) =>
        [...organizationIds].map((organizationId) => this.cache.invalidate(userId, organizationId)),
      ),
    );
  }

  async syncPermissionManifests() {
    const permissions = this.syncBasePermissions();
    const apiPermissions = this.syncBaseApiPermissions();
    this.pruneDisabledRolePermissions();
    this.pruneDisabledMenuApiBindings();
    await this.invalidateAllPermissionContexts();
    return {
      permissions,
      apiPermissions,
    };
  }

  listPermissions(filters: PermissionListFilters = {}): PermissionRecord[] {
    if (filters.status !== undefined && !isEntityStatus(filters.status)) {
      throw createKnownError("VALIDATION_INVALID_REQUEST");
    }
    if (filters.permissionType !== undefined && !isPermissionType(filters.permissionType)) {
      throw createKnownError("VALIDATION_INVALID_REQUEST");
    }

    const action = filters.action?.trim().toLocaleLowerCase();
    const keyword = filters.keyword?.trim().toLocaleLowerCase();
    const module = filters.module?.trim().toLocaleLowerCase();
    const permissionType = filters.permissionType?.trim();
    const resource = filters.resource?.trim().toLocaleLowerCase();
    const source = filters.source?.trim().toLocaleLowerCase();

    return [...this.context.store.permissions.values()]
      .filter((permission) => filters.status === undefined || permission.status === filters.status)
      .filter(
        (permission) => action === undefined || permission.action.toLocaleLowerCase() === action,
      )
      .filter(
        (permission) => module === undefined || permission.module.toLocaleLowerCase() === module,
      )
      .filter(
        (permission) =>
          permissionType === undefined || permission.permissionType === permissionType,
      )
      .filter(
        (permission) =>
          resource === undefined || permission.resource.toLocaleLowerCase() === resource,
      )
      .filter(
        (permission) => source === undefined || permission.source.toLocaleLowerCase() === source,
      )
      .filter(
        (permission) => keyword === undefined || matchesPermissionKeyword(permission, keyword),
      );
  }

  listPermissionTree(): PermissionTreeNode[] {
    const modules = new Map<string, PermissionTreeNode>();

    for (const permission of this.listPermissions({ status: "enabled" })) {
      const moduleNode = ensureNode(modules, permission.module, {
        key: `module:${permission.module}`,
        label: permission.module,
        level: "module",
        module: permission.module,
      });
      const resourceNode = ensureNode(childMap(moduleNode), permission.resource, {
        key: `module:${permission.module}:resource:${permission.resource}`,
        label: permission.resource,
        level: "resource",
        module: permission.module,
        resource: permission.resource,
      });
      const actionNode = ensureNode(childMap(resourceNode), permission.action, {
        key: `module:${permission.module}:resource:${permission.resource}:action:${permission.action}`,
        label: permission.action,
        level: "action",
        module: permission.module,
        resource: permission.resource,
        action: permission.action,
      });
      moduleNode.permissions.push(permission);
      resourceNode.permissions.push(permission);
      actionNode.permissions.push(permission);
    }

    return sortPermissionTree([...modules.values()]);
  }

  listApiPermissions(filters: ApiPermissionListFilters = {}): ApiPermissionRecord[] {
    if (filters.status !== undefined && !isEntityStatus(filters.status)) {
      throw createKnownError("VALIDATION_INVALID_REQUEST");
    }
    if (filters.method !== undefined && !isApiPermissionMethod(filters.method)) {
      throw createKnownError("VALIDATION_INVALID_REQUEST");
    }
    if (filters.logLevel !== undefined && !isApiPermissionLogLevel(filters.logLevel)) {
      throw createKnownError("VALIDATION_INVALID_REQUEST");
    }

    const keyword = filters.keyword?.trim().toLocaleLowerCase();
    const logLevel = filters.logLevel?.trim();
    const method = filters.method?.trim().toUpperCase();
    const module = filters.module?.trim().toLocaleLowerCase();
    return [...this.context.store.apiPermissions.values()]
      .filter((permission) => filters.status === undefined || permission.status === filters.status)
      .filter((permission) => logLevel === undefined || permission.logLevel === logLevel)
      .filter((permission) => method === undefined || permission.method.toUpperCase() === method)
      .filter(
        (permission) => module === undefined || permission.module.toLocaleLowerCase() === module,
      )
      .filter((permission) => filters.public === undefined || permission.public === filters.public)
      .filter(
        (permission) => keyword === undefined || matchesApiPermissionKeyword(permission, keyword),
      );
  }

  syncBasePermissions(): PermissionRecord[] {
    const now = toUtcIso(nowUtc());
    const currentCodes = new Set(basePermissionManifest.map((entry) => entry.code));
    for (const permission of this.context.store.permissions.values()) {
      if (permission.source === "base_manifest" && !currentCodes.has(permission.code)) {
        permission.status = "disabled";
        permission.updatedAt = now;
      }
    }
    return basePermissionManifest.map((entry) => {
      const manifestHash = hashBasePermissionManifestEntry(entry);
      const { resource, action } = parsePermissionCode(entry.code);
      const existing = [...this.context.store.permissions.values()].find(
        (permission) => permission.code === entry.code,
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
        updatedAt: now,
      };
      this.context.store.permissions.set(permission.id, permission);
      return permission;
    });
  }

  syncBaseApiPermissions(): ApiPermissionRecord[] {
    const now = toUtcIso(nowUtc());
    const currentCodes = new Set(baseApiPermissionManifest.map((entry) => entry.code));
    for (const apiPermission of this.context.store.apiPermissions.values()) {
      if (
        (apiPermission.source ?? "base_manifest") === "base_manifest" &&
        !currentCodes.has(apiPermission.code)
      ) {
        apiPermission.status = "disabled";
        apiPermission.updatedAt = now;
      }
    }
    return baseApiPermissionManifest.map((entry) => {
      const existing = this.findExistingApiPermissionForManifestEntry(entry);
      if (existing) {
        existing.method = entry.method;
        existing.path = entry.path;
        existing.code = entry.code;
        existing.description = entry.description;
        existing.module = entry.module;
        existing.requiredPermission = entry.requiredPermission ?? null;
        existing.logLevel = entry.logLevel;
        existing.public = entry.public;
        existing.status = "enabled";
        existing.source = "base_manifest";
        existing.manifestHash = null;
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
        source: "base_manifest",
        manifestHash: null,
        createdAt: now,
        updatedAt: now,
      };
      this.context.store.apiPermissions.set(apiPermission.id, apiPermission);
      return apiPermission;
    });
  }

  private findExistingApiPermissionForManifestEntry(
    entry: BaseApiPermissionManifestEntry,
  ): ApiPermissionRecord | undefined {
    return (
      [...this.context.store.apiPermissions.values()].find(
        (permission) => permission.code === entry.code,
      ) ??
      [...this.context.store.apiPermissions.values()].find(
        (permission) => permission.method === entry.method && permission.path === entry.path,
      )
    );
  }

  async getPermissionContext(userId: string, organizationId: string) {
    requireIntegerIdString(userId);
    requireIntegerIdString(organizationId);
    const cached = await this.cache.get(userId, organizationId);
    if (cached) return cached;

    const isSuperAdmin = this.hasActiveSuperAdminBinding(userId);
    const binding = [...this.context.store.userOrganizationRoles.values()].find(
      (candidate) =>
        candidate.userId === userId &&
        candidate.organizationId === organizationId &&
        isActiveBinding(candidate),
    );
    const role = binding ? this.context.store.roles.get(binding.roleId) : null;
    const basePermissionCodes = isSuperAdmin
      ? this.listEnabledPermissionCodes()
      : this.listRolePermissionCodes(binding?.roleId, role ?? null);
    const userPermissionOverrides = this.listActiveUserPermissionOverrideEffects(userId);
    const permissionCodes = this.applyUserPermissionOverrides(
      basePermissionCodes,
      userPermissionOverrides,
    );
    const roleIds = binding ? [binding.roleId] : [];
    const context = {
      userId,
      organizationId,
      permissionCodes,
      dataPermissions: this.listActiveRoleDataPermissionEffects(roleIds),
      fieldPermissions: this.listActiveRoleFieldPermissionEffects(roleIds),
      userPermissionOverrides,
    };
    await this.cache.set(context);
    return context;
  }

  private applyUserPermissionOverrides(
    basePermissionCodes: string[],
    overrides: Array<{ permissionCode: string; effect: "allow" | "deny" }>,
  ): string[] {
    const effective = new Set(basePermissionCodes);
    const enabledPermissionCodes = new Set(this.listEnabledPermissionCodes());

    for (const override of overrides) {
      if (!enabledPermissionCodes.has(override.permissionCode)) continue;
      if (override.effect === "deny") {
        effective.delete(override.permissionCode);
      } else {
        effective.add(override.permissionCode);
      }
    }

    return [...effective];
  }

  private listActiveUserPermissionOverrideEffects(userId: string) {
    return [...this.context.store.userPermissionOverrides.values()]
      .filter((record) => record.userId === userId && !record.isDeleted)
      .map((record) => ({
        permissionCode: record.permissionCode,
        effect: record.effect,
      }));
  }

  private listActiveRoleDataPermissionEffects(roleIds: string[]) {
    const roleIdSet = new Set(roleIds);
    return [...this.context.store.roleDataPermissions.values()]
      .filter((record) => roleIdSet.has(record.roleId) && !record.isDeleted)
      .map((record) => ({
        roleId: record.roleId,
        permissionCode: record.permissionCode,
        effect: record.effect,
        rule: record.rule,
      }));
  }

  private listActiveRoleFieldPermissionEffects(roleIds: string[]) {
    const roleIdSet = new Set(roleIds);
    return [...this.context.store.fieldPermissionRules.values()]
      .filter(
        (record) =>
          record.targetType === "role" && roleIdSet.has(record.targetId) && !record.isDeleted,
      )
      .map((record) => ({
        roleId: record.targetId,
        resource: record.resource,
        field: record.field,
        effect: record.effect,
      }));
  }

  private hasActiveSuperAdminBinding(userId: string): boolean {
    return [...this.context.store.userOrganizationRoles.values()].some((binding) => {
      if (binding.userId !== userId || !isActiveBinding(binding)) return false;
      const role = this.context.store.roles.get(binding.roleId);
      return (
        role?.code === builtInRoleCodes.superAdmin && role.status === "enabled" && !role.isDeleted
      );
    });
  }

  private listEnabledPermissionCodes(): string[] {
    return [...this.context.store.permissions.values()]
      .filter((permission) => permission.status === "enabled")
      .map((permission) => permission.code);
  }

  private listRolePermissionCodes(
    roleId: string | undefined,
    role: { status: "enabled" | "disabled"; isDeleted: boolean } | null,
  ): string[] {
    if (!roleId || role?.status !== "enabled" || role.isDeleted) return [];
    const enabledPermissionCodes = new Set(this.listEnabledPermissionCodes());
    const seenPermissionCodes = new Set<string>();
    const permissionCodes: string[] = [];
    this.context.store.rolePermissions
      .filter(
        (permission) =>
          permission.roleId === roleId &&
          permission.effect === "allow" &&
          enabledPermissionCodes.has(permission.permissionCode),
      )
      .forEach((permission) => {
        if (seenPermissionCodes.has(permission.permissionCode)) return;
        seenPermissionCodes.add(permission.permissionCode);
        permissionCodes.push(permission.permissionCode);
      });
    return permissionCodes;
  }

  private pruneDisabledRolePermissions(): void {
    const enabledPermissionCodes = new Set(this.listEnabledPermissionCodes());
    const retained = this.context.store.rolePermissions.filter((permission) =>
      enabledPermissionCodes.has(permission.permissionCode),
    );
    this.context.store.rolePermissions.splice(
      0,
      this.context.store.rolePermissions.length,
      ...retained,
    );
  }

  private pruneDisabledMenuApiBindings(): void {
    const enabledApiPermissionIds = new Set(
      [...this.context.store.apiPermissions.values()]
        .filter((apiPermission) => apiPermission.status === "enabled")
        .map((apiPermission) => apiPermission.id),
    );
    for (const [bindingId, binding] of this.context.store.menuApiBindings.entries()) {
      if (!enabledApiPermissionIds.has(binding.apiPermissionId)) {
        this.context.store.menuApiBindings.delete(bindingId);
      }
    }
  }
}

function childMap(node: PermissionTreeNode): Map<string, PermissionTreeNode> {
  const record = node as PermissionTreeNode & { childIndex?: Map<string, PermissionTreeNode> };
  if (!record.childIndex) record.childIndex = new Map();
  return record.childIndex;
}

function ensureNode(
  nodes: Map<string, PermissionTreeNode>,
  key: string,
  input: Omit<PermissionTreeNode, "permissions" | "children">,
): PermissionTreeNode {
  const existing = nodes.get(key);
  if (existing) return existing;
  const node = { ...input, permissions: [], children: [] };
  nodes.set(key, node);
  return node;
}

function sortPermissionTree(nodes: PermissionTreeNode[]): PermissionTreeNode[] {
  return nodes
    .map((node) => {
      const index = childMap(node);
      const children = sortPermissionTree([...index.values()]);
      const { childIndex: _childIndex, ...publicNode } = node as PermissionTreeNode & {
        childIndex?: Map<string, PermissionTreeNode>;
      };
      void _childIndex;
      return { ...publicNode, children };
    })
    .sort((left, right) => left.label.localeCompare(right.label));
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

function isEntityStatus(status: string): status is ApiPermissionRecord["status"] {
  return status === "enabled" || status === "disabled";
}

function isApiPermissionMethod(method: string): boolean {
  return ["GET", "POST", "PATCH", "PUT", "DELETE"].includes(method.toUpperCase());
}

function isApiPermissionLogLevel(logLevel: string): logLevel is ApiPermissionRecord["logLevel"] {
  return ["none", "basic", "request", "request_response"].includes(logLevel);
}

function isPermissionType(
  permissionType: string,
): permissionType is PermissionRecord["permissionType"] {
  return ["menu", "page", "action", "api", "data", "field"].includes(permissionType);
}

function matchesPermissionKeyword(permission: PermissionRecord, keyword: string): boolean {
  return [
    permission.code,
    permission.name,
    permission.description ?? "",
    permission.resource,
    permission.action,
  ].some((value) => value.toLocaleLowerCase().includes(keyword));
}

function matchesApiPermissionKeyword(permission: ApiPermissionRecord, keyword: string): boolean {
  return [
    permission.code,
    permission.path,
    permission.description ?? "",
    permission.requiredPermission ?? "",
  ].some((value) => value.toLocaleLowerCase().includes(keyword));
}

function hashBasePermissionManifestEntry(entry: PermissionManifestEntry): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        code: entry.code,
        description: entry.description,
        module: entry.module,
      }),
    )
    .digest("hex");
}

function parsePermissionCode(code: string): { resource: string; action: string } {
  const separatorIndex = code.indexOf(":");
  if (separatorIndex === -1) return { resource: code, action: "" };
  return {
    resource: code.slice(0, separatorIndex),
    action: code.slice(separatorIndex + 1),
  };
}
