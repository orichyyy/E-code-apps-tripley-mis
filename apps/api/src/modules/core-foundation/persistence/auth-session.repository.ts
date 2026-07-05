import type { InMemoryBackendStore } from "../in-memory-store";
import { TableWriter } from "./table-writer";

export class AuthSessionRepository extends TableWriter {
  async replaceFromStore(store: InMemoryBackendStore): Promise<void> {
    await this.replaceTables(async () => {
      await this.deleteFrom("refresh_tokens");
      await this.deleteFrom("auth_sessions");
      await this.insertMany(
        "auth_sessions",
        [
          "id",
          "tenant_id",
          "user_id",
          "refresh_token_hash",
          "current_organization_id",
          "token_version",
          "status",
          "ip_address",
          "user_agent",
          "expires_at",
          "revoked_at",
          "created_at",
          "last_seen_at",
        ],
        [...store.authSessions.values()].map((record) => [
          record.id,
          record.tenantId,
          record.userId,
          record.refreshTokenHash,
          record.currentOrganizationId,
          record.tokenVersion,
          record.status,
          record.ipAddress,
          record.userAgent,
          record.expiresAt,
          record.revokedAt,
          record.createdAt,
          record.lastSeenAt,
        ]),
      );
      await this.insertMany(
        "refresh_tokens",
        [
          "id",
          "tenant_id",
          "session_id",
          "user_id",
          "token_hash",
          "token_version",
          "expires_at",
          "revoked_at",
          "created_at",
        ],
        [...store.refreshTokens.values()].map((record) => [
          record.id,
          record.tenantId,
          record.sessionId,
          record.userId,
          record.tokenHash,
          record.tokenVersion,
          record.expiresAt,
          record.revokedAt,
          record.createdAt,
        ]),
      );
    });
  }
}
