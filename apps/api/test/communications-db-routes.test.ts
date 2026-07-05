import type { DatabaseAdapterExecutor } from "@web-admin-base/adapters";
import { runPostgresqlMigrations } from "@web-admin-base/db";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app";
import { CommunicationsRepository } from "../src/modules/communications/communications.repository";
import { CommunicationsServices } from "../src/modules/communications/communications.service";
import { createInMemoryBackendCoreServices } from "../src/modules/core-foundation/services";
import { createPostgresqlInfrastructureExecutor } from "../src/modules/infrastructure/infrastructure.executor";

const postgresqlUrl = process.env.TEST_DATABASE_URL;

describe("database-backed communications routes", () => {
  it.runIf(postgresqlUrl)(
    "persists announcement and webhook subscription mutations in PostgreSQL",
    async () => {
      const url = getPostgresqlUrl();
      await runPostgresqlMigrations({ url });
      const executor = createPostgresqlInfrastructureExecutor(url);
      const communicationsServices = CommunicationsServices.database(
        new CommunicationsRepository(executor),
      );
      const app = createApp({
        communicationsServices,
        backendCoreServices: createInMemoryBackendCoreServices(),
      });

      try {
        await clearCommunicationsTables(executor);
        await initialize(app);
        const headers = await loginHeaders(app);

        const announcementResponse = await app.request("/api/announcements", {
          method: "POST",
          headers,
          body: JSON.stringify({
            title: "DB Announcement",
            content: "Persisted content",
            scopeType: "organization",
          }),
        });
        const announcementBody = await announcementResponse.json();
        const publishResponse = await app.request(
          `/api/announcements/${announcementBody.data.id}/publish`,
          {
            method: "POST",
            headers,
          },
        );
        const webhookResponse = await app.request("/api/webhooks", {
          method: "POST",
          headers,
          body: JSON.stringify({
            name: "DB Webhook",
            url: "https://example.com/db-webhook",
            eventTypes: ["announcement.published"],
            secret: "db-secret",
            status: "enabled",
          }),
        });
        const webhookBody = await webhookResponse.json();
        const persistedAnnouncements = await executor.all(
          "SELECT id, title, scope_type, status, published_at FROM announcements WHERE id = $1",
          [announcementBody.data.id],
        );
        const persistedWebhooks = await executor.all(
          "SELECT id, name, event_types, secret, status FROM webhook_subscriptions WHERE id = $1",
          [webhookBody.data.id],
        );

        expect(announcementResponse.status).toBe(201);
        expect(publishResponse.status).toBe(200);
        expect(webhookResponse.status).toBe(201);
        expect(webhookBody.data).toEqual(
          expect.objectContaining({ id: webhookBody.data.id, secretConfigured: true }),
        );
        expect(webhookBody.data).not.toHaveProperty("secret");
        expect(persistedAnnouncements).toEqual([
          expect.objectContaining({
            title: "DB Announcement",
            scope_type: "organization",
            status: "published",
            published_at: expect.any(Date),
          }),
        ]);
        expect(persistedWebhooks).toEqual([
          expect.objectContaining({
            name: "DB Webhook",
            event_types: ["announcement.published"],
            secret: "db-secret",
            status: "enabled",
          }),
        ]);
      } finally {
        await clearCommunicationsTables(executor);
        await communicationsServices.close();
      }
    },
  );
});

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

async function clearCommunicationsTables(executor: DatabaseAdapterExecutor): Promise<void> {
  for (const table of ["webhook_subscriptions", "announcements"]) {
    await executor.run(`DELETE FROM ${table}`);
  }
}

function getPostgresqlUrl(): string {
  if (!postgresqlUrl) throw new Error("TEST_DATABASE_URL is required for PostgreSQL API tests.");
  return postgresqlUrl;
}
