import type { InMemoryBackendStore } from "../in-memory-store";
import { TableWriter } from "./table-writer";

export class PermissionMetadataRepository extends TableWriter {
  async replaceFromStore(store: InMemoryBackendStore): Promise<void> {
    await this.replaceTables(async () => {
      await this.deleteFrom("menu_api_bindings");
      await this.deleteFrom("role_permissions");
      await this.deleteFrom("api_permissions");
      await this.deleteFrom("permissions");
      await this.insertPermissions(store);
      await this.insertApiPermissions(store);
      await this.insertRolePermissions(store);
      await this.insertMenuApiBindings(store);
    });
  }

  private async insertPermissions(store: InMemoryBackendStore): Promise<void> {
    await this.insertMany(
      "permissions",
      [
        "id",
        "tenant_id",
        "code",
        "name",
        "permission_type",
        "resource",
        "action",
        "description",
        "module",
        "source",
        "manifest_hash",
        "status",
        "created_at",
        "updated_at",
      ],
      [...store.permissions.values()].map((record) => [
        record.id,
        record.tenantId,
        record.code,
        record.name,
        record.permissionType,
        record.resource,
        record.action,
        record.description,
        record.module,
        record.source ?? "base_manifest",
        record.manifestHash ?? null,
        record.status,
        record.createdAt,
        record.updatedAt,
      ]),
    );
  }

  private async insertApiPermissions(store: InMemoryBackendStore): Promise<void> {
    await this.insertMany(
      "api_permissions",
      [
        "id",
        "tenant_id",
        "method",
        "path",
        "code",
        "description",
        "module",
        "required_permission",
        "log_level",
        "public",
        "source",
        "manifest_hash",
        "status",
        "created_at",
        "updated_at",
      ],
      [...store.apiPermissions.values()].map((record) => [
        record.id,
        record.tenantId,
        record.method,
        record.path,
        record.code,
        record.description,
        record.module,
        record.requiredPermission,
        record.logLevel,
        record.public,
        record.source,
        record.manifestHash,
        record.status,
        record.createdAt,
        record.updatedAt,
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

  private async insertMenuApiBindings(store: InMemoryBackendStore): Promise<void> {
    await this.insertMany(
      "menu_api_bindings",
      ["id", "tenant_id", "menu_id", "api_permission_id", "created_at"],
      [...store.menuApiBindings.values()].map((record) => [
        record.id,
        record.tenantId,
        record.menuId,
        record.apiPermissionId,
        record.createdAt,
      ]),
    );
  }
}
