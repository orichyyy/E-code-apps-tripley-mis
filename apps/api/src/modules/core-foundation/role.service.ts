import {
  basePermissionManifest,
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
    this.context.store.rolePermissions
      .filter((permission) => permission.roleId === source.id)
      .forEach((permission) => {
        this.context.store.rolePermissions.push({
          roleId: copy.id,
          permissionCode: permission.permissionCode,
          createdAt: now
        });
      });
    return copy;
  }

  updatePermissions(id: string, input: UpdateRolePermissionsRequest): RoleRecord {
    const role = requireRole(this.context.store, id);
    const knownPermissions = new Set(basePermissionManifest.map((permission) => permission.code));
    input.permissionCodes.forEach((permissionCode) => {
      if (!knownPermissions.has(permissionCode)) throw createKnownError("PERMISSION_UNKNOWN_CODE");
    });

    const retained = this.context.store.rolePermissions.filter((permission) => permission.roleId !== id);
    this.context.store.rolePermissions.splice(0, this.context.store.rolePermissions.length, ...retained);
    const now = toUtcIso(nowUtc());
    input.permissionCodes.forEach((permissionCode) => {
      this.context.store.rolePermissions.push({ roleId: id, permissionCode, createdAt: now });
    });
    role.updatedAt = now;
    return role;
  }

  listPermissionCodes(id: string): string[] {
    requireRole(this.context.store, id);
    return this.context.store.rolePermissions
      .filter((permission) => permission.roleId === id)
      .map((permission) => permission.permissionCode);
  }

  delete(id: string, deletedBy: string | null = null): RoleRecord {
    const role = requireRole(this.context.store, id);
    const now = toUtcIso(nowUtc());
    role.isDeleted = true;
    role.deletedAt = now;
    role.deletedBy = deletedBy;
    role.updatedAt = now;
    role.updatedBy = deletedBy;
    return role;
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
      (role) => !role.isDeleted && role.id !== currentRoleId && role.code === code
    );
  }
}
