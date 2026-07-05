import type { InMemoryBackendStore } from "../in-memory-store";
import { TableWriter } from "./table-writer";

export class OrganizationRepository extends TableWriter {
  async replaceFromStore(store: InMemoryBackendStore): Promise<void> {
    await this.replaceTables(async () => {
      await this.deleteFrom("organizations");
      await this.insertMany(
        "organizations",
        [
          "id",
          "tenant_id",
          "path",
          "level",
          "segment",
          "name",
          "code",
          "manager_user_id",
          "phone",
          "email",
          "address",
          "sort_order",
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
        [...store.organizations.values()].map((record) => [
          record.id,
          record.tenantId,
          record.path,
          record.level,
          record.segment,
          record.name,
          record.code,
          record.managerUserId,
          record.phone,
          record.email,
          record.address,
          record.sortOrder,
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
    });
  }
}
