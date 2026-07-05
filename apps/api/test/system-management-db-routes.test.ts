import type { DatabaseAdapterExecutor } from "@web-admin-base/adapters";
import { runPostgresqlMigrations } from "@web-admin-base/db";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app";
import { createInMemoryBackendCoreServices } from "../src/modules/core-foundation/services";
import { createPostgresqlInfrastructureExecutor } from "../src/modules/infrastructure/infrastructure.executor";
import { SystemManagementRepository } from "../src/modules/system-management/system-management.repository";
import { SystemManagementServices } from "../src/modules/system-management/system-management.service";

const postgresqlUrl = process.env.TEST_DATABASE_URL;

describe("database-backed system management routes", () => {
  it.runIf(postgresqlUrl)(
    "persists system config, dictionary, and i18n mutations in PostgreSQL",
    async () => {
      const url = getPostgresqlUrl();
      await runPostgresqlMigrations({ url });
      const executor = createPostgresqlInfrastructureExecutor(url);
      const systemManagementServices = SystemManagementServices.database(
        new SystemManagementRepository(executor),
      );
      const app = createApp({
        systemManagementServices,
        backendCoreServices: createInMemoryBackendCoreServices(),
      });

      try {
        await clearSystemManagementTables(executor);
        await seedSystemManagementRows(executor);
        const i18nId = await getI18nMessageId(executor, "system.title");
        await initialize(app);
        const headers = await loginHeaders(app);

        const configResponse = await app.request("/api/system-config/password.minimumLength", {
          method: "PATCH",
          headers,
          body: JSON.stringify({ configValue: 10 }),
        });
        const typeResponse = await app.request("/api/dictionary-types", {
          method: "POST",
          headers,
          body: JSON.stringify({ code: "db_status", name: "DB Status" }),
        });
        const typeBody = await typeResponse.json();
        const itemResponse = await app.request(`/api/dictionary-types/${typeBody.data.id}/items`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            itemValue: "enabled",
            labelI18nKey: "dictionary.db_status.enabled",
          }),
        });
        const i18nResponse = await app.request(`/api/i18n/messages/${i18nId}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ messageValue: "Updated" }),
        });
        const persisted = await executor.all(
          `SELECT
          (SELECT config_value FROM system_configs WHERE config_key = $1) AS config_value,
          (SELECT code FROM dictionary_types WHERE code = $2) AS dictionary_code,
          (SELECT message_value FROM i18n_messages WHERE id = $3) AS message_value`,
          ["password.minimumLength", "db_status", i18nId],
        );

        expect(configResponse.status).toBe(200);
        expect(typeResponse.status).toBe(201);
        expect(itemResponse.status).toBe(201);
        expect(i18nResponse.status).toBe(200);
        expect(persisted[0]).toEqual(
          expect.objectContaining({
            dictionary_code: "db_status",
            message_value: "Updated",
          }),
        );
      } finally {
        await clearSystemManagementTables(executor);
        await systemManagementServices.close();
      }
    },
  );
});

async function seedSystemManagementRows(executor: DatabaseAdapterExecutor): Promise<void> {
  await executor.run(
    `INSERT INTO system_configs (config_key, config_value, value_type, group_key, description, editable, status, updated_at)
     VALUES ($1, $2, 'number', 'password', 'Minimum password length', TRUE, 'enabled', $3)`,
    ["password.minimumLength", "8", new Date().toISOString()],
  );
  await executor.run(
    `INSERT INTO i18n_messages (message_key, language, message_value, module, updated_at)
     VALUES ($1, 'en', 'Initial', 'system', $2)`,
    ["system.title", new Date().toISOString()],
  );
}

async function getI18nMessageId(
  executor: DatabaseAdapterExecutor,
  messageKey: string,
): Promise<string> {
  const rows = await executor.all("SELECT id FROM i18n_messages WHERE message_key = $1", [
    messageKey,
  ]);
  if (!rows[0]) throw new Error(`Missing i18n message ${messageKey}`);
  return String(rows[0].id);
}

async function initialize(app: ReturnType<typeof createApp>): Promise<void> {
  const response = await app.request("/api/initialization/setup", {
    method: "POST",
    body: JSON.stringify({
      organizationName: "Default Organization",
      organizationCode: "default",
      adminUsername: "admin",
      adminDisplayName: "Super Admin",
      adminEmail: "admin@example.com",
      adminPhone: "10000000000",
      adminPassword: "password1",
    }),
  });
  expect(response.status).toBe(201);
}

async function loginHeaders(app: ReturnType<typeof createApp>) {
  const response = await app.request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: "admin", password: "password1" }),
  });
  const body = await response.json();
  expect(response.status).toBe(200);
  return { authorization: `Bearer ${body.data.accessToken}` };
}

async function clearSystemManagementTables(executor: DatabaseAdapterExecutor): Promise<void> {
  for (const table of ["dictionary_items", "dictionary_types", "i18n_messages", "system_configs"]) {
    await executor.run(`DELETE FROM ${table}`);
  }
}

function getPostgresqlUrl(): string {
  if (!postgresqlUrl) throw new Error("TEST_DATABASE_URL is required for PostgreSQL API tests.");
  return postgresqlUrl;
}
