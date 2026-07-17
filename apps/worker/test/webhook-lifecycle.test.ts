import {
  createDatabaseLockAdapter,
  type AlertEvent,
  type WebhookHttpClient,
} from "@web-admin-base/adapters";
import { describe, expect, it, vi } from "vitest";

import { createWebhookDeliveryCleanupTaskHandler } from "../src/tasks/webhook-cleanup-task";
import { createWebhookDeliveryProcessor } from "../src/webhooks/webhook-delivery.processor";
import { WebhookDeliveryRepository } from "../src/webhooks/webhook-delivery.repository";
import {
  createWebhookTestDatabase,
  seedOutboxEvent,
  seedSubscription,
  userCreatedEvent,
  webhookTestConfig,
} from "./webhook-test-helpers";

describe("webhook delivery lifecycle", () => {
  it("honors bounded Retry-After and alerts on a final HTTP failure", async () => {
    const database = createWebhookTestDatabase("retry");
    const responses = [
      { statusCode: 503, durationMs: 4, retryAfter: "1" },
      { statusCode: 400, durationMs: 3, retryAfter: null },
    ];
    const httpClient: WebhookHttpClient = { send: vi.fn(async () => responses.shift()!) };
    const alerts: AlertEvent[] = [];
    try {
      await seedSubscription(database.executor, { name: "retry", url: "https://example.com/hook" });
      await seedOutboxEvent(database.executor, userCreatedEvent());
      const repository = new WebhookDeliveryRepository(database.executor);
      const processor = createWebhookDeliveryProcessor({
        repository,
        config: webhookTestConfig(),
        workerId: "retry-worker",
        httpClient,
        alert: {
          notify: async (event) => {
            alerts.push(event);
          },
        },
      });

      await processor.fanOutPending();
      const before = Date.now();
      await processor.processReady();
      const retried = (
        await database.executor.all("SELECT status, next_attempt_at FROM webhook_deliveries")
      )[0];
      expect(retried?.status).toBe("pending");
      expect(new Date(String(retried?.next_attempt_at)).getTime()).toBeGreaterThanOrEqual(
        before + 29_000,
      );

      await database.executor.run(
        "UPDATE webhook_deliveries SET next_attempt_at = ? WHERE status = 'pending'",
        [new Date(0).toISOString()],
      );
      await processor.processReady();

      const delivery = (
        await database.executor.all(
          "SELECT status, attempt, last_http_status FROM webhook_deliveries",
        )
      )[0];
      expect({
        ...delivery,
        attempt: Number(delivery?.attempt),
        last_http_status: Number(delivery?.last_http_status),
      }).toMatchObject({ status: "failed", attempt: 2, last_http_status: 400 });
      expect(alerts).toEqual([
        expect.objectContaining({
          code: "WEBHOOK_DELIVERY_FAILED",
          metadata: expect.objectContaining({ targetHost: "example.com", httpStatus: 400 }),
        }),
      ]);
    } finally {
      await database.close();
    }
  });

  it("cancels pending delivery when its subscription revision changes", async () => {
    const database = createWebhookTestDatabase("revision");
    const send = vi.fn();
    try {
      const subscriptionId = await seedSubscription(database.executor, {
        name: "revision",
        url: "https://example.com/hook",
      });
      await seedOutboxEvent(database.executor, userCreatedEvent());
      const repository = new WebhookDeliveryRepository(database.executor);
      const processor = createWebhookDeliveryProcessor({
        repository,
        config: webhookTestConfig(),
        workerId: "revision-worker",
        httpClient: { send },
      });

      await processor.fanOutPending();
      await database.executor.run(
        "UPDATE webhook_subscriptions SET revision = revision + 1 WHERE id = ?",
        [subscriptionId],
      );

      await expect(processor.processReady()).resolves.toBe(0);
      expect(send).not.toHaveBeenCalled();
      await expect(database.executor.all("SELECT status FROM webhook_deliveries")).resolves.toEqual(
        [expect.objectContaining({ status: "canceled" })],
      );
    } finally {
      await database.close();
    }
  });

  it("fans out directed notifications only to the selected subscription", async () => {
    const database = createWebhookTestDatabase("directed");
    try {
      const selectedId = await seedSubscription(database.executor, {
        name: "selected",
        url: "https://selected.example.com/hook",
        eventTypes: ["notification.requested"],
      });
      await seedSubscription(database.executor, {
        name: "other",
        url: "https://other.example.com/hook",
        eventTypes: ["notification.requested"],
      });
      const occurredAt = new Date().toISOString();
      await seedOutboxEvent(
        database.executor,
        {
          targetSubscriptionId: selectedId,
          subject: "notifications/91",
          occurredAt,
          data: {
            notificationId: "91",
            subject: "Directed",
            body: "Payload",
            locale: "en",
            referenceType: null,
            referenceId: null,
          },
        },
        "notification.requested",
        "pending",
        occurredAt,
      );
      const repository = new WebhookDeliveryRepository(database.executor);

      await expect(repository.fanOutPending("test", 5)).resolves.toBe(1);
      const deliveries = await database.executor.all(
        "SELECT subscription_id FROM webhook_deliveries",
      );
      expect(deliveries.map((row) => String(row.subscription_id))).toEqual([selectedId]);
    } finally {
      await database.close();
    }
  });

  it("runs retention cleanup under a distributed lock and applies Outbox retention", async () => {
    const database = createWebhookTestDatabase("cleanup");
    const firstLock = createDatabaseLockAdapter(database.executor, { owner: "first" });
    const cleanupLock = createDatabaseLockAdapter(database.executor, { owner: "cleanup" });
    const old = new Date(Date.now() - 100 * 86_400_000).toISOString();
    try {
      const subscriptionId = await seedSubscription(database.executor, {
        name: "cleanup",
        url: "https://example.com/hook",
      });
      const outboxId = await seedOutboxEvent(
        database.executor,
        userCreatedEvent(old),
        "user.created",
        "published",
        old,
      );
      await database.executor.run(
        `INSERT INTO webhook_deliveries
         (event_outbox_id, subscription_id, subscription_revision, event_type, event_source,
          event_payload_json, target_url, status, attempt, max_attempts, next_attempt_at,
          succeeded_at, created_at, updated_at)
         VALUES (?, ?, 1, 'user.created', 'test', '{}', 'https://example.com/hook',
          'succeeded', 1, 5, ?, ?, ?, ?)`,
        [outboxId, subscriptionId, old, old, old, old],
      );
      const blocker = await firstLock.acquire("webhook.delivery.cleanup", { ttlSeconds: 60 });
      const cleanup = createWebhookDeliveryCleanupTaskHandler(
        database.executor,
        webhookTestConfig({ retentionDays: 90 }),
        cleanupLock,
      );

      await cleanup();
      expect(await count(database, "webhook_deliveries")).toBe(1);
      await blocker?.release();
      await cleanup();

      expect(await count(database, "webhook_deliveries")).toBe(0);
      expect(await count(database, "event_outbox")).toBe(0);
    } finally {
      await database.close();
    }
  });
});

async function count(
  database: ReturnType<typeof createWebhookTestDatabase>,
  table: "webhook_deliveries" | "event_outbox",
) {
  const rows = await database.executor.all(`SELECT COUNT(*) AS count FROM ${table}`);
  return Number(rows[0]?.count ?? 0);
}
