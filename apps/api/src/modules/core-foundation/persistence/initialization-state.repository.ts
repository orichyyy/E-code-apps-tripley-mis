import type { InMemoryBackendStore } from "../in-memory-store";
import { TableWriter } from "./table-writer";

export class InitializationStateRepository extends TableWriter {
  async replaceFromStore(store: InMemoryBackendStore): Promise<void> {
    const record = store.initializationState;
    await this.replaceTables(async () => {
      await this.deleteFrom("system_initialization_state");
      await this.insertMany(
        "system_initialization_state",
        [
          "id",
          "tenant_id",
          "status",
          "initialized_at",
          "initialized_by",
          "version",
          "created_at",
          "updated_at",
        ],
        record
          ? [
              [
                record.id,
                record.tenantId,
                record.status,
                record.initializedAt,
                record.initializedBy,
                record.version,
                record.createdAt,
                record.updatedAt,
              ],
            ]
          : [],
      );
    });
  }
}
