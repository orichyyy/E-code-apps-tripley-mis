import type { InMemoryBackendStore } from "../in-memory-store";
import { jsonValue } from "./row-values";
import { TableWriter } from "./table-writer";

export class PermissionExtensionRepository extends TableWriter {
  async replaceFromStore(store: InMemoryBackendStore): Promise<void> {
    await this.replaceTables(async () => {
      await this.deleteFrom("user_permission_overrides");
      await this.deleteFrom("field_permission_rules");
      await this.deleteFrom("role_data_permissions");
      await this.insertRoleDataPermissions(store);
      await this.insertFieldPermissionRules(store);
      await this.insertUserPermissionOverrides(store);
    });
  }

  private async insertRoleDataPermissions(store: InMemoryBackendStore): Promise<void> {
    await this.insertMany(
      "role_data_permissions",
      [
        "id",
        "tenant_id",
        "role_id",
        "permission_id",
        "effect",
        "rule_json",
        "is_deleted",
        "deleted_at",
        "deleted_by",
        "created_at",
        "updated_at",
        "created_by",
        "updated_by",
      ],
      [...store.roleDataPermissions.values()].map((record) => [
        record.id,
        record.tenantId,
        record.roleId,
        record.permissionId,
        record.effect,
        jsonValue(record.rule),
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

  private async insertFieldPermissionRules(store: InMemoryBackendStore): Promise<void> {
    await this.insertMany(
      "field_permission_rules",
      [
        "id",
        "tenant_id",
        "target_type",
        "target_id",
        "resource",
        "field",
        "scenario",
        "effect",
        "is_deleted",
        "deleted_at",
        "deleted_by",
        "created_at",
        "updated_at",
        "created_by",
        "updated_by",
      ],
      [...store.fieldPermissionRules.values()].map((record) => [
        record.id,
        record.tenantId,
        record.targetType,
        record.targetId,
        record.resource,
        record.field,
        record.scenario,
        record.effect,
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

  private async insertUserPermissionOverrides(store: InMemoryBackendStore): Promise<void> {
    await this.insertMany(
      "user_permission_overrides",
      [
        "id",
        "tenant_id",
        "user_id",
        "permission_id",
        "effect",
        "is_deleted",
        "deleted_at",
        "deleted_by",
        "created_at",
        "updated_at",
        "created_by",
        "updated_by",
      ],
      [...store.userPermissionOverrides.values()].map((record) => [
        record.id,
        record.tenantId,
        record.userId,
        record.permissionId,
        record.effect,
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
}
