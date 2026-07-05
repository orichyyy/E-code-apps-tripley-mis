import type { InMemoryBackendStore } from "../in-memory-store";
import { TableWriter } from "./table-writer";

export class RoleRepository extends TableWriter {
  async replaceFromStore(store: InMemoryBackendStore): Promise<void> {
    await this.replaceTables(async () => {
      await this.deleteFrom("role_permissions");
      await this.deleteFrom("roles");
      await this.insertRoles(store);
      await this.insertRolePermissions(store);
    });
  }

  async replaceRolePermissionsFromStore(store: InMemoryBackendStore): Promise<void> {
    await this.replaceTables(async () => {
      await this.deleteFrom("role_permissions");
      await this.insertRolePermissions(store);
    });
  }

  private async insertRoles(store: InMemoryBackendStore): Promise<void> {
    await this.insertMany(
      "roles",
      [
        "id",
        "tenant_id",
        "name",
        "code",
        "description",
        "data_scope_rule_id",
        "is_builtin",
        "status",
        "remark",
        "is_deleted",
        "deleted_at",
        "deleted_by",
        "created_at",
        "updated_at",
        "created_by",
        "updated_by",
      ],
      [...store.roles.values()].map((record) => [
        record.id,
        record.tenantId,
        record.name,
        record.code,
        record.description,
        record.dataScopeRuleId,
        record.isBuiltin,
        record.status,
        record.remark,
        record.isDeleted,
        record.deletedAt,
        record.deletedBy,
        record.createdAt,
        record.updatedAt,
        record.createdBy,
        record.updatedBy,
      ]),
    );
  }

  private async insertRolePermissions(store: InMemoryBackendStore): Promise<void> {
    const permissionIdsByCode = new Map(
      [...store.permissions.values()].map((permission) => [permission.code, permission.id]),
    );
    await this.insertMany(
      "role_permissions",
      ["role_id", "permission_id", "effect", "created_at", "updated_at"],
      store.rolePermissions.flatMap((record) => {
        const permissionId = permissionIdsByCode.get(record.permissionCode);
        if (!permissionId) return [];
        return [[record.roleId, permissionId, record.effect, record.createdAt, record.updatedAt]];
      }),
    );
  }
}
