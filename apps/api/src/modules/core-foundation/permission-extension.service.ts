import type {
  FieldPermissionRuleRecord,
  PermissionRecord,
  RoleDataPermissionRecord,
  UserPermissionOverrideRecord,
} from "./domain";
import type { BackendCoreContext } from "./service-context";
import { requireRole, requireUser } from "./store-guards";
import { createKnownError } from "../../core/errors/error-codes";
import { nowUtc, toUtcIso } from "../../core/time/utc";

export type RoleDataPermissionInput = {
  permissionCode: string;
  effect: "allow" | "deny";
  rule: Record<string, unknown>;
};

export type RoleFieldPermissionInput = {
  resource: string;
  field: string;
  effect: "visible" | "hidden" | "readonly";
};

export type UserPermissionOverrideInput = {
  permissionCode: string;
  effect: "allow" | "deny";
};

type PermissionInvalidator = {
  invalidateRole(roleId: string): Promise<void>;
  invalidateUser(userId: string): Promise<void>;
};

export class PermissionExtensionService {
  constructor(
    private readonly context: BackendCoreContext,
    private readonly invalidator: PermissionInvalidator,
  ) {}

  listRoleDataPermissions(roleId: string): RoleDataPermissionRecord[] {
    requireRole(this.context.store, roleId);
    return [...this.context.store.roleDataPermissions.values()]
      .filter((record) => record.roleId === roleId && !record.isDeleted)
      .sort(compareById);
  }

  async updateRoleDataPermissions(
    roleId: string,
    input: { rules: RoleDataPermissionInput[] },
    actorId: string | null = null,
  ): Promise<RoleDataPermissionRecord[]> {
    requireRole(this.context.store, roleId);
    const now = toUtcIso(nowUtc());
    const rules = input.rules.map((rule) => ({
      ...rule,
      permission: this.requirePermissionByCode(rule.permissionCode),
    }));

    for (const record of this.context.store.roleDataPermissions.values()) {
      if (record.roleId !== roleId || record.isDeleted) continue;
      softDelete(record, now, actorId);
    }

    for (const rule of rules) {
      const record =
        this.findRoleDataPermission(roleId, rule.permission.id) ??
        ({
          id: this.context.store.nextId("roleDataPermission"),
          tenantId: null,
          roleId,
          permissionId: rule.permission.id,
          permissionCode: rule.permission.code,
          effect: rule.effect,
          rule: rule.rule,
          createdAt: now,
          createdBy: actorId,
        } as RoleDataPermissionRecord);
      record.permissionCode = rule.permission.code;
      record.effect = rule.effect;
      record.rule = rule.rule;
      restore(record, now, actorId);
      this.context.store.roleDataPermissions.set(record.id, record);
    }

    await this.invalidator.invalidateRole(roleId);
    return this.listRoleDataPermissions(roleId);
  }

  listRoleFieldPermissions(roleId: string): FieldPermissionRuleRecord[] {
    requireRole(this.context.store, roleId);
    return [...this.context.store.fieldPermissionRules.values()]
      .filter(
        (record) => record.targetType === "role" && record.targetId === roleId && !record.isDeleted,
      )
      .sort(compareById);
  }

  async updateRoleFieldPermissions(
    roleId: string,
    input: { rules: RoleFieldPermissionInput[] },
    actorId: string | null = null,
  ): Promise<FieldPermissionRuleRecord[]> {
    requireRole(this.context.store, roleId);
    const now = toUtcIso(nowUtc());

    for (const record of this.context.store.fieldPermissionRules.values()) {
      if (record.targetType !== "role" || record.targetId !== roleId || record.isDeleted) continue;
      softDelete(record, now, actorId);
    }

    for (const rule of input.rules) {
      const record =
        this.findRoleFieldPermission(roleId, rule.resource, rule.field) ??
        ({
          id: this.context.store.nextId("fieldPermissionRule"),
          tenantId: null,
          targetType: "role",
          targetId: roleId,
          resource: rule.resource,
          field: rule.field,
          effect: rule.effect,
          createdAt: now,
          createdBy: actorId,
        } as FieldPermissionRuleRecord);
      record.effect = rule.effect;
      restore(record, now, actorId);
      this.context.store.fieldPermissionRules.set(record.id, record);
    }

    await this.invalidator.invalidateRole(roleId);
    return this.listRoleFieldPermissions(roleId);
  }

  listUserPermissionOverrides(userId: string): UserPermissionOverrideRecord[] {
    requireUser(this.context.store, userId);
    return [...this.context.store.userPermissionOverrides.values()]
      .filter((record) => record.userId === userId && !record.isDeleted)
      .sort(compareById);
  }

  async updateUserPermissionOverrides(
    userId: string,
    input: { overrides: UserPermissionOverrideInput[] },
    actorId: string | null = null,
  ): Promise<UserPermissionOverrideRecord[]> {
    requireUser(this.context.store, userId);
    const now = toUtcIso(nowUtc());
    const overrides = input.overrides.map((override) => ({
      ...override,
      permission: this.requirePermissionByCode(override.permissionCode),
    }));

    for (const record of this.context.store.userPermissionOverrides.values()) {
      if (record.userId !== userId || record.isDeleted) continue;
      softDelete(record, now, actorId);
    }

    for (const override of overrides) {
      const record =
        this.findUserPermissionOverride(userId, override.permission.id) ??
        ({
          id: this.context.store.nextId("userPermissionOverride"),
          tenantId: null,
          userId,
          permissionId: override.permission.id,
          permissionCode: override.permission.code,
          effect: override.effect,
          createdAt: now,
          createdBy: actorId,
        } as UserPermissionOverrideRecord);
      record.permissionCode = override.permission.code;
      record.effect = override.effect;
      restore(record, now, actorId);
      this.context.store.userPermissionOverrides.set(record.id, record);
    }

    await this.invalidator.invalidateUser(userId);
    return this.listUserPermissionOverrides(userId);
  }

  private requirePermissionByCode(code: string): PermissionRecord {
    const permission = [...this.context.store.permissions.values()].find(
      (candidate) => candidate.code === code && candidate.status === "enabled",
    );
    if (!permission) throw createKnownError("PERMISSION_UNKNOWN_CODE");
    return permission;
  }

  private findRoleDataPermission(
    roleId: string,
    permissionId: string,
  ): RoleDataPermissionRecord | undefined {
    return [...this.context.store.roleDataPermissions.values()].find(
      (record) => record.roleId === roleId && record.permissionId === permissionId,
    );
  }

  private findRoleFieldPermission(
    roleId: string,
    resource: string,
    field: string,
  ): FieldPermissionRuleRecord | undefined {
    return [...this.context.store.fieldPermissionRules.values()].find(
      (record) =>
        record.targetType === "role" &&
        record.targetId === roleId &&
        record.resource === resource &&
        record.field === field,
    );
  }

  private findUserPermissionOverride(
    userId: string,
    permissionId: string,
  ): UserPermissionOverrideRecord | undefined {
    return [...this.context.store.userPermissionOverrides.values()].find(
      (record) => record.userId === userId && record.permissionId === permissionId,
    );
  }
}

function softDelete(
  record: {
    isDeleted: boolean;
    deletedAt: string | null;
    deletedBy: string | null;
    updatedAt: string;
    updatedBy: string | null;
  },
  deletedAt: string,
  deletedBy: string | null,
): void {
  record.isDeleted = true;
  record.deletedAt = deletedAt;
  record.deletedBy = deletedBy;
  record.updatedAt = deletedAt;
  record.updatedBy = deletedBy;
}

function restore(
  record: {
    isDeleted: boolean;
    deletedAt: string | null;
    deletedBy: string | null;
    updatedAt: string;
    updatedBy: string | null;
  },
  updatedAt: string,
  updatedBy: string | null,
): void {
  record.isDeleted = false;
  record.deletedAt = null;
  record.deletedBy = null;
  record.updatedAt = updatedAt;
  record.updatedBy = updatedBy;
}

function compareById(left: { id: string }, right: { id: string }): number {
  return Number(left.id) - Number(right.id);
}
