import { SmtpDeliveryError, type NotificationChannelAdapter } from "@web-admin-base/adapters";
import { describe, expect, it } from "vitest";

import { createEmailDeliveryProcessor } from "../src/email/email-delivery.processor";
import { WorkerEmailDeliveryRepository } from "../src/email/email-delivery.repository";
import {
  createEmailDeliveryCleanupTaskHandler,
  emailDeliveryCleanupTaskCode,
} from "../src/tasks/email-delivery-cleanup-task";
import { createPostgresqlEmailFixture, smtpTestConfig } from "./email-delivery-postgresql-fixture";

const postgresqlUrl = process.env.TEST_DATABASE_URL;

describe("reliable email PostgreSQL lifecycle", () => {
  it.runIf(postgresqlUrl)("retries transient failures and purges corrupt content", async () => {
    const fixture = await createPostgresqlEmailFixture(requirePostgresqlUrl());
    try {
      const retry = await fixture.seed();
      const corrupt = await fixture.seed({ envelope: "email:v1:primary:invalid:invalid:invalid" });
      const alerts: string[] = [];
      const processor = createEmailDeliveryProcessor({
        repository: new WorkerEmailDeliveryRepository(fixture.executor),
        config: fixture.config,
        smtp: smtpTestConfig(),
        channel: transientFailureChannel(),
        workerId: "pg-lifecycle-worker",
        alert: {
          async notify(event) {
            alerts.push(event.code);
          },
        },
      });

      expect(await processor.processReady()).toBe(2);
      const rows = await fixture.executor.all(
        `SELECT id, status, attempt, last_error_code, content_envelope, content_purged_at
         FROM email_deliveries WHERE id IN ($1, $2) ORDER BY id`,
        [retry.id, corrupt.id],
      );
      expect(rows.find((row) => String(row.id) === retry.id)).toMatchObject({
        status: "pending",
        attempt: 1,
        last_error_code: "SMTP_TRANSIENT_RESPONSE",
      });
      expect(rows.find((row) => String(row.id) === corrupt.id)).toMatchObject({
        status: "failed",
        attempt: 1,
        last_error_code: "CONTENT_DECRYPTION_FAILED",
        content_envelope: null,
      });
      expect(rows.find((row) => String(row.id) === corrupt.id)?.content_purged_at).toBeTruthy();
      expect(alerts).toContain("CONTENT_DECRYPTION_FAILED");
      const attempts = await fixture.executor.all(
        "SELECT delivery_id, status FROM email_delivery_attempts WHERE delivery_id IN ($1, $2)",
        [retry.id, corrupt.id],
      );
      expect(attempts).toHaveLength(2);
    } finally {
      await fixture.close();
    }
  });

  it.runIf(postgresqlUrl)(
    "recovers stale work, cancels deleted users, reports missing keys, and retains active work",
    async () => {
      const fixture = await createPostgresqlEmailFixture(requirePostgresqlUrl());
      try {
        const repository = new WorkerEmailDeliveryRepository(fixture.executor);
        const old = "2000-01-01T00:00:00.000Z";
        const stale = await fixture.seed({
          status: "running",
          attempt: 1,
          maxAttempts: 1,
          lockedAt: old,
        });
        const deleted = await fixture.seed({ deleted: true });
        const missing = await fixture.seed({ keyId: "retired" });
        const retained = await fixture.seed();
        const expired = await fixture.seed({ status: "succeeded", createdAt: old });

        expect(await repository.recoverStaleRunning(60)).toEqual([
          expect.objectContaining({ id: stale.id }),
        ]);
        await repository.cancelDeletedUsers();
        expect(await repository.unavailableKeyIds(["primary"])).toContain("retired");
        const acquired: string[] = [];
        const cleanup = createEmailDeliveryCleanupTaskHandler(fixture.executor, fixture.config, {
          healthCheck: async () => ({ ok: true }),
          async acquire(key) {
            acquired.push(key);
            return { key, release: async () => undefined };
          },
        });
        await cleanup();
        expect(acquired).toEqual([emailDeliveryCleanupTaskCode]);

        const rows = await fixture.executor.all(
          `SELECT id, status, content_envelope, content_purged_at
           FROM email_deliveries WHERE id IN ($1, $2, $3, $4, $5)`,
          [stale.id, deleted.id, missing.id, retained.id, expired.id],
        );
        expect(rows.find((row) => String(row.id) === stale.id)).toMatchObject({
          status: "failed",
          content_envelope: null,
        });
        expect(rows.find((row) => String(row.id) === deleted.id)).toMatchObject({
          status: "canceled",
          content_envelope: null,
        });
        expect(rows.find((row) => String(row.id) === missing.id)?.status).toBe("pending");
        expect(rows.find((row) => String(row.id) === retained.id)?.status).toBe("pending");
        expect(rows.some((row) => String(row.id) === expired.id)).toBe(false);
      } finally {
        await fixture.close();
      }
    },
  );
});

function transientFailureChannel(): NotificationChannelAdapter {
  return {
    healthCheck: async () => ({ ok: true }),
    async send() {
      throw new SmtpDeliveryError("SMTP_TRANSIENT_RESPONSE", true, 451);
    },
  };
}

function requirePostgresqlUrl(): string {
  if (!postgresqlUrl) throw new Error("TEST_DATABASE_URL is required.");
  return postgresqlUrl;
}
