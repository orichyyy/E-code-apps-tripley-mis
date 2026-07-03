import type { InMemoryBackendStore } from "../in-memory-store";
import { TableWriter } from "./table-writer";

export class UserPreferenceRepository extends TableWriter {
  async replaceFromStore(store: InMemoryBackendStore): Promise<void> {
    await this.replaceTables(async () => {
      await this.deleteFrom("user_preferences");
      await this.insertMany("user_preferences", [
        "id", "tenant_id", "user_id", "language", "theme_mode", "theme_color",
        "page_tabs_enabled", "updated_at"
      ], [...store.userPreferences.values()].map((record) => [
        record.id, record.tenantId, record.userId, record.language, record.themeMode,
        record.themeColor, record.pageTabsEnabled, record.updatedAt
      ]));
    });
  }
}
