import { loadWebhookDeliveryConfig, type DatabaseAdapterExecutor } from "@web-admin-base/adapters";
import { randomBytes } from "node:crypto";
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
        loadWebhookDeliveryConfig({
          NODE_ENV: "test",
          WEBHOOK_SECRET_KEYS: JSON.stringify({ test: randomBytes(32).toString("base64") }),
          WEBHOOK_SECRET_ACTIVE_KEY_ID: "test",
        }),
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
            scopeType: "system",
            targetOrganizationIds: [],
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
            eventTypes: ["user.created"],
            secret: "db-secret",
            status: "enabled",
          }),
        });
        const webhookBody = await webhookResponse.json();
        const now = new Date().toISOString();
        const outboxRows = await executor.all(
          `INSERT INTO event_outbox
           (event_type, payload_json, status, attempt, max_attempts, occurred_at, created_at, updated_at)
           VALUES ('user.created', $1, 'published', 0, 1, $2, $3, $4) RETURNING id`,
          [{ type: "user.created", secret: "must-not-leak" }, now, now, now],
        );
        const deliveryRows = await executor.all(
          `INSERT INTO webhook_deliveries
           (event_outbox_id, subscription_id, subscription_revision, event_type, event_source,
            event_payload_json, target_url, status, attempt, max_attempts, next_attempt_at,
            created_at, updated_at)
           VALUES ($1, $2, 1, 'user.created', 'test', $3,
            'https://example.com/private/path?token=must-not-leak', 'pending', 0, 5, $4, $5, $6)
           RETURNING id`,
          [outboxRows[0]?.id, webhookBody.data.id, { secret: "must-not-leak" }, now, now, now],
        );
        const listDeliveryResponse = await app.request("/api/webhook-deliveries", { headers });
        const detailDeliveryResponse = await app.request(
          `/api/webhook-deliveries/${deliveryRows[0]?.id}`,
          { headers },
        );
        const updateWebhookResponse = await app.request(`/api/webhooks/${webhookBody.data.id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ status: "disabled" }),
        });
        const persistedAnnouncements = await executor.all(
          "SELECT id, title, scope_type, status, published_at FROM announcements WHERE id = $1",
          [announcementBody.data.id],
        );
        const persistedWebhooks = await executor.all(
          "SELECT id, name, event_types, secret, revision, status FROM webhook_subscriptions WHERE id = $1",
          [webhookBody.data.id],
        );

        expect(announcementResponse.status).toBe(201);
        expect(publishResponse.status).toBe(200);
        expect(webhookResponse.status).toBe(201);
        expect(webhookBody.data).toEqual(
          expect.objectContaining({ id: webhookBody.data.id, secretConfigured: true }),
        );
        expect(webhookBody.data).not.toHaveProperty("secret");
        expect(listDeliveryResponse.status).toBe(200);
        expect(detailDeliveryResponse.status).toBe(200);
        const safeDeliveryJson = JSON.stringify([
          await listDeliveryResponse.json(),
          await detailDeliveryResponse.json(),
        ]);
        expect(safeDeliveryJson).toContain('"targetHost":"example.com"');
        expect(safeDeliveryJson).not.toContain("must-not-leak");
        expect(safeDeliveryJson).not.toContain("/private/path");
        expect(updateWebhookResponse.status).toBe(200);
        expect(persistedAnnouncements).toEqual([
          expect.objectContaining({
            title: "DB Announcement",
            scope_type: "system",
            status: "published",
            published_at: expect.any(Date),
          }),
        ]);
        expect(persistedWebhooks).toEqual([
          expect.objectContaining({
            name: "DB Webhook",
            event_types: ["user.created"],
            secret: expect.stringMatching(/^enc:v1:test:/),
            revision: 2,
            status: "disabled",
          }),
        ]);
        await expect(
          executor.all("SELECT status FROM webhook_deliveries WHERE id = $1", [
            deliveryRows[0]?.id,
          ]),
        ).resolves.toEqual([expect.objectContaining({ status: "canceled" })]);
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
  for (const table of [
    "webhook_delivery_attempts",
    "webhook_deliveries",
    "webhook_subscriptions",
    "announcement_targets",
    "announcements",
    "event_outbox",
  ]) {
    await executor.run(`DELETE FROM ${table}`);
  }
}

function getPostgresqlUrl(): string {
  if (!postgresqlUrl) throw new Error("TEST_DATABASE_URL is required for PostgreSQL API tests.");
  return postgresqlUrl;
}
