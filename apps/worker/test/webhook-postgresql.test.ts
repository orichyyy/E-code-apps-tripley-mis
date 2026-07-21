import { jsonParam } from "@web-admin-base/adapters";
import { runPostgresqlMigrations } from "@web-admin-base/db";
import { describe, expect, it } from "vitest";

import { createWorkerDatabaseExecutor } from "../src/infra/worker-database-executor";
import { WebhookDeliveryRepository } from "../src/webhooks/webhook-delivery.repository";

const postgresqlUrl = process.env.TEST_DATABASE_URL;

describe("PostgreSQL webhook delivery claims", () => {
  it.runIf(postgresqlUrl)("serializes subscriptions and recovers stale running work", async () => {
    const url = requirePostgresqlUrl();
    await runPostgresqlMigrations({ url });
    const executorA = createWorkerDatabaseExecutor({ dialect: "postgresql", url });
    const executorB = createWorkerDatabaseExecutor({ dialect: "postgresql", url });
    const repositoryA = new WebhookDeliveryRepository(executorA);
    const repositoryB = new WebhookDeliveryRepository(executorB);
    const marker = `pg-webhook-${process.pid}-${Date.now()}`;
    let subscriptionId: string | null = null;
    const outboxIds: string[] = [];
    try {
      const now = new Date().toISOString();
      const subscriptions = await executorA.all(
        `INSERT INTO webhook_subscriptions
         (name, url, event_types, revision, status, is_deleted, created_at, updated_at)
         VALUES ($1, 'https://example.com/hook', $2, 1, 'enabled', FALSE, $3, $4)
         RETURNING id`,
        [marker, jsonParam(["user.created"], "postgresql"), now, now],
      );
      subscriptionId = String(subscriptions[0]?.id);
      for (const userId of ["41", "42"]) {
        const rows = await executorA.all(
          `INSERT INTO event_outbox
           (event_type, payload_json, status, attempt, max_attempts, occurred_at, created_at, updated_at)
           VALUES ('user.created', $1, 'pending', 0, 1, $2, $3, $4) RETURNING id`,
          [
            jsonParam(
              {
                subject: `users/${userId}`,
                occurredAt: now,
                data: { userId, primaryOrganizationId: "1", createdByUserId: "1" },
              },
              "postgresql",
            ),
            now,
            now,
            now,
          ],
        );
        outboxIds.push(String(rows[0]?.id));
      }
      await expect(repositoryA.fanOutPending("test", 5)).resolves.toBeGreaterThanOrEqual(2);

      const [claimsA, claimsB] = await Promise.all([
        repositoryA.claimReady("worker-a", 1),
        repositoryB.claimReady("worker-b", 1),
      ]);
      expect(claimsA.length + claimsB.length).toBe(1);

      const claimed = [...claimsA, ...claimsB][0];
      expect(claimed?.subscriptionId).toBe(subscriptionId);
      await executorA.run("UPDATE webhook_deliveries SET locked_at = $1 WHERE id = $2", [
        "2020-01-01T00:00:00.000Z",
        claimed?.id,
      ]);
      await executorA.run(
        "UPDATE webhook_deliveries SET next_attempt_at = $1 WHERE status = 'pending' AND id <> $2",
        ["2099-01-01T00:00:00.000Z", claimed?.id],
      );
      await repositoryB.recoverStaleRunning(1);
      const recovered = await repositoryB.claimReady("worker-b", 1);
      expect(recovered).toHaveLength(1);
      expect(recovered[0]?.attempt).toBe(2);
    } finally {
      if (subscriptionId) {
        await executorA.run(
          "DELETE FROM webhook_delivery_attempts WHERE delivery_id IN (SELECT id FROM webhook_deliveries WHERE subscription_id = $1)",
          [subscriptionId],
        );
        await executorA.run("DELETE FROM webhook_deliveries WHERE subscription_id = $1", [
          subscriptionId,
        ]);
        await executorA.run("DELETE FROM webhook_subscriptions WHERE id = $1", [subscriptionId]);
      }
      for (const id of outboxIds)
        await executorA.run("DELETE FROM event_outbox WHERE id = $1", [id]);
      await executorA.close();
      await executorB.close();
    }
  });
});

function requirePostgresqlUrl(): string {
  if (!postgresqlUrl) throw new Error("TEST_DATABASE_URL is required.");
  return postgresqlUrl;
}
