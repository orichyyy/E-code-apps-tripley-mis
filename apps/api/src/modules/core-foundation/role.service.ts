import {
  type CreateRoleRequest,
  type UpdateRolePermissionsRequest,
  type UpdateRoleRequest
} from "@web-admin-base/contracts";

import { createKnownError } from "../../core/errors/error-codes";
import { nowUtc, toUtcIso } from "../../core/time/utc";
import type { RoleRecord } from "./domain";
import type { BackendCoreContext } from "./service-context";
import { requireRole } from "./store-guards";

export class RoleService {
  constructor(private readonly context: BackendCoreContext) {}

  list(): RoleRecord[] {
    return [...this.context.store.roles.values()].filter((role) => !role.isDeleted);
  }

  get(id: string): RoleRecord {
    return requireRole(this.context.store, id);
  }

  create(input: CreateRoleRequest, actorId: string | null = null): RoleRecord {
    return this.createRecord(input, actorId);
  }

  createRecord(
    input: CreateRoleRequest,
    actorId: string | null = null,
    options: { isBuiltin?: boolean; dataScopeRuleId?: string | null } = {}
  ): RoleRecord {
    const store = this.context.store;
    this.ensureUniqueRoleCode(input.code);
    const now = toUtcIso(nowUtc());
    const role: RoleRecord = {
      id: store.nextId("role"),
      tenantId: null,
      name: input.name,
      code: input.code,
      description: input.description ?? null,
      dataScopeRuleId: options.dataScopeRuleId ?? null,
      isBuiltin: options.isBuiltin ?? false,
      status: "enabled",
      remark: input.remark ?? null,
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
      createdAt: now,
      updatedAt: now,
      createdBy: actorId,
      updatedBy: actorId
    };
    store.roles.set(role.id, role);
    return role;
  }

  update(id: string, input: UpdateRoleRequest, actorId: string | null = null): RoleRecord {
    const role = requireRole(this.context.store, id);
    if (input.code !== undefined) this.ensureUniqueRoleCode(input.code, role.id);
    if (input.name !== undefined) role.name = input.name;
    if (input.code !== undefined) role.code = input.code;
    if (input.description !== undefined) role.description = input.description;
    if (input.remark !== undefined) role.remark = input.remark;
    role.updatedAt = toUtcIso(nowUtc());
    role.updatedBy = actorId;
    return role;
  }

  setStatus(
    id: string,
    status: "enabled" | "disabled",
    actorId: string | null = null
  ): RoleRecord {
    const role = requireRole(this.context.store, id);
    role.status = status;
    role.updatedAt = toUtcIso(nowUtc());
    role.updatedBy = actorId;
    return role;
  }

  copy(id: string, actorId: string | null = null): RoleRecord {
    const source = requireRole(this.context.store, id);
    const copy = this.createRecord({
      name: `${source.name} Copy`,
      code: this.nextCopyCode(source.code),
      description: source.description ?? undefined,
      remark: source.remark ?? undefined
    }, actorId, { dataScopeRuleId: source.dataScopeRuleId });
    const now = toUtcIso(nowUtc());
    const enabledPermissionCodes = this.listEnabledPermissionCodeSet();
    const copiedPermissionCodes = new Set<string>();
    for (const permission of this.context.store.rolePermissions) {
      if (permission.roleId !== source.id) continue;
      if (!enabledPermissionCodes.has(permission.permissionCode)) continue;
      if (copiedPermissionCodes.has(permission.permissionCode)) continue;
      copiedPermissionCodes.add(permission.permissionCode);
      this.context.store.rolePermissions.push({
        roleId: copy.id,
        permissionCode: permission.permissionCode,
        effect: permission.effect,
        createdAt: now,
        updatedAt: now
      });
    }
    return copy;
  }

  updatePermissions(
    id: string,
    input: UpdateRolePermissionsRequest,
    actorId: string | null = null
  ): RoleRecord {
    const role = requireRole(this.context.store, id);
    const knownPermissions = this.listEnabledPermissionCodeSet();
    const permissionCodes = [...new Set(input.permissionCodes)];
    permissionCodes.forEach((permissionCode) => {
      if (!knownPermissions.has(permissionCode)) throw createKnownError("PERMISSION_UNKNOWN_CODE");
    });

    const retained = this.context.store.rolePermissions.filter((permission) => permission.roleId !== id);
    this.context.store.rolePermissions.splice(0, this.context.store.rolePermissions.length, ...retained);
    const now = toUtcIso(nowUtc());
    permissionCodes.forEach((permissionCode) => {
      this.context.store.rolePermissions.push({
        roleId: id,
        permissionCode,
        effect: "allow",
        createdAt: now,
        updatedAt: now
      });
    });
    role.updatedAt = now;
    role.updatedBy = actorId;
    return role;
  }

  listPermissionCodes(id: string): string[] {
    requireRole(this.context.store, id);
    const enabledPermissionCodes = this.listEnabledPermissionCodeSet();
    const seenPermissionCodes = new Set<string>();
    const permissionCodes: string[] = [];
    this.context.store.rolePermissions
      .filter(
        (permission) =>
          permission.roleId === id &&
          permission.effect === "allow" &&
          enabledPermissionCodes.has(permission.permissionCode)
      )
      .forEach((permission) => {
        if (seenPermissionCodes.has(permission.permissionCode)) return;
        seenPermissionCodes.add(permission.permissionCode);
        permissionCodes.push(permission.permissionCode);
      });
    return permissionCodes;
  }

  delete(id: string, deletedBy: string | null = null): RoleRecord {
    const role = requireRole(this.context.store, id);
    const now = toUtcIso(nowUtc());
    role.isDeleted = true;
    role.deletedAt = now;
    role.deletedBy = deletedBy;
    role.updatedAt = now;
    role.updatedBy = deletedBy;
    this.softDeleteRoleBindings(role.id, now, deletedBy);
    this.deleteRolePermissions(role.id);
    return role;
  }

  private softDeleteRoleBindings(
    roleId: string,
    deletedAt: string,
    deletedBy: string | null
  ): void {
    for (const binding of this.context.store.userOrganizationRoles.values()) {
      if (binding.roleId !== roleId || binding.isDeleted) continue;
      binding.isDeleted = true;
      binding.isPrimary = false;
      binding.status = "disabled";
      binding.deletedAt = deletedAt;
      binding.deletedBy = deletedBy;
      binding.updatedAt = deletedAt;
      binding.updatedBy = deletedBy;
    }
  }

  private deleteRolePermissions(roleId: string): void {
    const retained = this.context.store.rolePermissions.filter(
      (permission) => permission.roleId !== roleId
    );
    this.context.store.rolePermissions.splice(
      0,
      this.context.store.rolePermissions.length,
      ...retained
    );
  }

  private ensureUniqueRoleCode(code: string, currentRoleId?: string): void {
    const duplicate = this.roleCodeExists(code, currentRoleId);
    if (duplicate) throw createKnownError("VALIDATION_DUPLICATE_ROLE_CODE");
  }

  private nextCopyCode(sourceCode: string): string {
    let suffix = 1;
    let candidate = `${sourceCode}_copy`;
    while (this.roleCodeExists(candidate)) {
      suffix += 1;
      candidate = `${sourceCode}_copy_${suffix}`;
    }
    return candidate;
  }

  private roleCodeExists(code: string, currentRoleId?: string): boolean {
    return [...this.context.store.roles.values()].some(
      (role) => role.id !== currentRoleId && role.code === code
    );
  }

  private listEnabledPermissionCodeSet(): Set<string> {
    return new Set(
      [...this.context.store.permissions.values()]
        .filter((permission) => permission.status === "enabled")
        .map((permission) => permission.code)
    );
  }
}
