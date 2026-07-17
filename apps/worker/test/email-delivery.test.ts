import { SmtpDeliveryError, type NotificationChannelAdapter } from "@web-admin-base/adapters";
import { afterEach, describe, expect, it } from "vitest";

import { createEmailDeliveryProcessor } from "../src/email/email-delivery.processor";
import { WorkerEmailDeliveryRepository } from "../src/email/email-delivery.repository";
import {
  createSqliteEmailDatabase,
  rejectOverlappingTransactions,
  seedAdditionalSqliteEmailDelivery,
  seedSqliteEmailDelivery,
  smtpTestConfig,
  sqliteEmailDeliveryConfig,
  type SqliteEmailDatabase,
} from "./email-delivery-sqlite-fixture";

let database: SqliteEmailDatabase | null = null;

afterEach(async () => {
  if (!database) return;
  await database.close();
  database = null;
});

describe("reliable email delivery worker", () => {
  it("sends a claimed delivery with a stable message id and purges terminal content", async () => {
    database = createSqliteEmailDatabase("success");
    const config = sqliteEmailDeliveryConfig();
    const id = await seedSqliteEmailDelivery(database.executor, config);
    const sent: Array<{ messageId?: string; recipient: string }> = [];
    const channel: NotificationChannelAdapter = {
      healthCheck: async () => ({ ok: true }),
      async send(message) {
        sent.push({ messageId: message.messageId, recipient: message.recipient });
      },
    };
    const processor = createEmailDeliveryProcessor({
      repository: new WorkerEmailDeliveryRepository(database.executor),
      config,
      smtp: smtpTestConfig(),
      channel,
      workerId: "worker-1",
    });

    expect(await processor.processReady()).toBe(1);
    expect(sent).toEqual([{ messageId: "<stable@example.local>", recipient: "a@example.com" }]);
    const rows = await database.executor.all(
      "SELECT status, content_envelope, content_key_id, content_purged_at FROM email_deliveries WHERE id = ?",
      [id],
    );
    expect(rows[0]).toMatchObject({
      status: "succeeded",
      content_envelope: null,
      content_key_id: null,
    });
    expect(rows[0]?.content_purged_at).toBeTruthy();
  });

  it("serializes attempt persistence after concurrent SMTP sends", async () => {
    database = createSqliteEmailDatabase("concurrent-persistence");
    const config = sqliteEmailDeliveryConfig();
    await seedSqliteEmailDelivery(database.executor, config);
    await seedAdditionalSqliteEmailDelivery(database.executor, config);
    const guardedExecutor = rejectOverlappingTransactions(database.executor);
    const processor = createEmailDeliveryProcessor({
      repository: new WorkerEmailDeliveryRepository(guardedExecutor),
      config,
      smtp: smtpTestConfig(),
      channel: { healthCheck: async () => ({ ok: true }), send: async () => undefined },
      workerId: "worker-1",
    });

    expect(await processor.processReady()).toBe(2);
    const attempts = await database.executor.all(
      "SELECT delivery_id, status FROM email_delivery_attempts ORDER BY delivery_id",
    );
    expect(attempts).toHaveLength(2);
    expect(attempts.every((attempt) => attempt.status === "succeeded")).toBe(true);
  });

  it("keeps transient SMTP failures pending and records a safe attempt", async () => {
    database = createSqliteEmailDatabase("retry");
    const config = sqliteEmailDeliveryConfig();
    await seedSqliteEmailDelivery(database.executor, config);
    const channel: NotificationChannelAdapter = {
      healthCheck: async () => ({ ok: true }),
      async send() {
        throw new SmtpDeliveryError("SMTP_TRANSIENT_RESPONSE", true, 451);
      },
    };
    const processor = createEmailDeliveryProcessor({
      repository: new WorkerEmailDeliveryRepository(database.executor),
      config,
      smtp: smtpTestConfig(),
      channel,
      workerId: "worker-1",
    });

    await processor.processReady();
    const deliveries = await database.executor.all(
      "SELECT status, attempt, last_smtp_code, content_envelope FROM email_deliveries",
    );
    const attempts = await database.executor.all(
      "SELECT status, smtp_code, error_code FROM email_delivery_attempts",
    );
    expect({
      ...deliveries[0],
      attempt: Number(deliveries[0]?.attempt),
      last_smtp_code: Number(deliveries[0]?.last_smtp_code),
    }).toMatchObject({ status: "pending", attempt: 1, last_smtp_code: 451 });
    expect(deliveries[0]?.content_envelope).toBeTruthy();
    expect({ ...attempts[0], smtp_code: Number(attempts[0]?.smtp_code) }).toMatchObject({
      status: "failed",
      smtp_code: 451,
      error_code: "SMTP_TRANSIENT_RESPONSE",
    });
  });

  it("does not misclassify an unexpected transport failure as content corruption", async () => {
    database = createSqliteEmailDatabase("transport-failure");
    const config = sqliteEmailDeliveryConfig();
    await seedSqliteEmailDelivery(database.executor, config);
    const processor = createEmailDeliveryProcessor({
      repository: new WorkerEmailDeliveryRepository(database.executor),
      config,
      smtp: smtpTestConfig(),
      channel: {
        healthCheck: async () => ({ ok: true }),
        async send() {
          throw new Error("unexpected adapter failure");
        },
      },
      workerId: "worker-1",
    });

    await processor.processReady();
    const rows = await database.executor.all(
      "SELECT status, last_error_code FROM email_deliveries",
    );
    expect(rows[0]).toMatchObject({ status: "failed", last_error_code: "SMTP_DELIVERY_FAILED" });
  });

  it("does not claim work encrypted with an unavailable key", async () => {
    database = createSqliteEmailDatabase("missing-key");
    const config = sqliteEmailDeliveryConfig();
    await seedSqliteEmailDelivery(database.executor, config);
    const missingConfig = { ...config, contentKeys: new Map<string, Uint8Array>() };
    const alerts: string[] = [];
    const processor = createEmailDeliveryProcessor({
      repository: new WorkerEmailDeliveryRepository(database.executor),
      config: missingConfig,
      smtp: smtpTestConfig(),
      channel: { healthCheck: async () => ({ ok: true }), send: async () => undefined },
      workerId: "worker-1",
      alert: {
        async notify(event) {
          alerts.push(event.code);
        },
      },
    });

    expect(await processor.health()).toEqual({ ok: false, missingKeyIds: ["primary"] });
    expect(await processor.processReady()).toBe(0);
    expect(await processor.processReady()).toBe(0);
    expect(alerts).toEqual(["EMAIL_CONTENT_KEY_UNAVAILABLE"]);
    const rows = await database.executor.all("SELECT status, attempt FROM email_deliveries");
    expect(rows.map((row) => ({ status: row.status, attempt: Number(row.attempt) }))).toEqual([
      { status: "pending", attempt: 0 },
    ]);
  });

  it("cancels and purges pending work after user soft deletion", async () => {
    database = createSqliteEmailDatabase("deleted-user");
    const config = sqliteEmailDeliveryConfig();
    await seedSqliteEmailDelivery(database.executor, config);
    await database.executor.run("UPDATE users SET is_deleted = 1, deleted_at = ? WHERE id = 1", [
      new Date().toISOString(),
    ]);
    const processor = createEmailDeliveryProcessor({
      repository: new WorkerEmailDeliveryRepository(database.executor),
      config,
      smtp: smtpTestConfig(),
      channel: { healthCheck: async () => ({ ok: true }), send: async () => undefined },
      workerId: "worker-1",
    });

    expect(await processor.processReady()).toBe(0);
    const rows = await database.executor.all(
      "SELECT status, content_envelope, content_purged_at FROM email_deliveries",
    );
    expect(rows[0]).toMatchObject({ status: "canceled", content_envelope: null });
    expect(rows[0]?.content_purged_at).toBeTruthy();
  });
});
