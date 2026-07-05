import type { InMemoryBackendStore } from "../in-memory-store";
import { TableWriter } from "./table-writer";

export class UserOrganizationRoleRepository extends TableWriter {
  async replaceFromStore(store: InMemoryBackendStore): Promise<void> {
    await this.replaceTables(async () => {
      await this.deleteFrom("user_organization_roles");
      await this.insertMany(
        "user_organization_roles",
        [
          "id",
          "tenant_id",
          "user_id",
          "organization_id",
          "role_id",
          "is_primary",
          "status",
          "is_deleted",
          "deleted_at",
          "deleted_by",
          "created_at",
          "updated_at",
          "created_by",
          "updated_by",
        ],
        [...store.userOrganizationRoles.values()].map((record) => [
          record.id,
          record.tenantId,
          record.userId,
          record.organizationId,
          record.roleId,
          record.isPrimary,
          record.status,
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
