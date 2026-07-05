import type { InMemoryBackendStore } from "../in-memory-store";
import { TableWriter } from "./table-writer";

export class MenuRepository extends TableWriter {
  async replaceFromStore(store: InMemoryBackendStore): Promise<void> {
    await this.replaceTables(async () => {
      await this.deleteFrom("menu_api_bindings");
      await this.deleteFrom("menus");
      await this.insertMany(
        "menus",
        [
          "id",
          "tenant_id",
          "parent_menu_id",
          "permission_code",
          "code",
          "route_code",
          "title_i18n_key",
          "path",
          "icon",
          "sort_order",
          "visible",
          "status",
          "is_deleted",
          "deleted_at",
          "deleted_by",
          "created_at",
          "updated_at",
        ],
        [...store.menus.values()].map((record) => [
          record.id,
          record.tenantId,
          record.parentMenuId,
          record.requiredPermission,
          record.code,
          record.routeCode,
          record.titleI18nKey,
          record.path,
          record.icon,
          record.sortOrder,
          record.visible,
          record.status,
          record.isDeleted,
          record.deletedAt,
          record.deletedBy,
          record.createdAt,
          record.updatedAt,
        ]),
      );
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
    });
  }
}
