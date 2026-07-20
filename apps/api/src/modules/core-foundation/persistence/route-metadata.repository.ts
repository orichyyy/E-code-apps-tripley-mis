import type { InMemoryBackendStore } from "../in-memory-store";
import { TableWriter } from "./table-writer";
import { jsonValue } from "./row-values";

export class RouteMetadataRepository extends TableWriter {
  async replaceFromStore(store: InMemoryBackendStore): Promise<void> {
    await this.replaceTables(async () => {
      await this.deleteFrom("route_metadata");
      await this.insertMany(
        "route_metadata",
        [
          "id",
          "tenant_id",
          "route_code",
          "path",
          "title_i18n_key",
          "required_permission",
          "metadata_json",
          "manifest_hash",
          "menu_visible",
          "icon",
          "sort_order",
          "status",
          "source",
          "owner_module",
          "created_at",
          "updated_at",
        ],
        [...store.routeMetadata.values()].map((record) => [
          record.id,
          record.tenantId,
          record.routeCode,
          record.path,
          record.titleI18nKey,
          record.requiredPermission,
          jsonValue(record.metadataJson),
          record.manifestHash,
          record.menuVisible,
          record.icon,
          record.sortOrder,
          record.status,
          record.source ?? "base_manifest",
          record.ownerModule,
          record.createdAt,
          record.updatedAt,
        ]),
      );
    });
  }
}
