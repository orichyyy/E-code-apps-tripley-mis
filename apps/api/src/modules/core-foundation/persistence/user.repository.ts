import type { InMemoryBackendStore } from "../in-memory-store";
import { TableWriter } from "./table-writer";

export class UserRepository extends TableWriter {
  async replaceFromStore(store: InMemoryBackendStore): Promise<void> {
    await this.replaceTables(async () => {
      await this.deleteFrom("users");
      await this.insertMany("users", [
        "id", "tenant_id", "username", "display_name", "email", "phone", "avatar_file_id", "gender",
        "employee_number", "password_hash", "primary_organization_id", "status",
        "first_login_password_change_required", "password_changed_at", "password_expires_at",
        "failed_login_attempts", "locked_until", "token_version", "last_login_at", "remark",
        "is_deleted", "deleted_at", "deleted_by", "created_at", "updated_at", "created_by", "updated_by"
      ], [...store.users.values()].map((record) => [
        record.id, record.tenantId, record.username, record.displayName, record.email, record.phone,
        record.avatarFileId, record.gender, record.employeeNumber, record.passwordHash,
        record.primaryOrganizationId, record.status, record.firstLoginPasswordChangeRequired,
        record.passwordChangedAt, record.passwordExpiresAt, record.failedLoginAttempts, record.lockedUntil,
        record.tokenVersion, record.lastLoginAt, record.remark, record.isDeleted, record.deletedAt,
        record.deletedBy, record.createdAt, record.updatedAt, record.createdBy, record.updatedBy
      ]));
    });
  }
}
