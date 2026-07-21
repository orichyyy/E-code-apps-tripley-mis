import { randomUUID } from "node:crypto";

import {
  encryptEmailContent,
  type EmailDeliveryConfig,
  type NotificationChannelAdapter,
} from "@web-admin-base/adapters";
import { runPostgresqlMigrations } from "@web-admin-base/db";
import { describe, expect, it } from "vitest";

import { createEmailDeliveryProcessor } from "../src/email/email-delivery.processor";
import { WorkerEmailDeliveryRepository } from "../src/email/email-delivery.repository";
import { createWorkerDatabaseExecutor } from "../src/infra/worker-database-executor";

const postgresqlUrl = process.env.TEST_DATABASE_URL;

describe("reliable email worker PostgreSQL claims", () => {
  it.runIf(postgresqlUrl)("claims one delivery once across concurrent workers", async () => {
    const url = requirePostgresqlUrl();
    await runPostgresqlMigrations({ url });
    const firstExecutor = createWorkerDatabaseExecutor({ dialect: "postgresql", url });
    const secondExecutor = createWorkerDatabaseExecutor({ dialect: "postgresql", url });
    const suffix = randomUUID();
    const config = deliveryConfig();
    let requestKey = "";
    try {
      requestKey = await seed(firstExecutor, suffix, config);
      const sent: string[] = [];
      const channel: NotificationChannelAdapter = {
        healthCheck: async () => ({ ok: true }),
        async send(message) {
          await new Promise((resolve) => setTimeout(resolve, 25));
          sent.push(message.messageId ?? "");
        },
      };
      const processors = [firstExecutor, secondExecutor].map((executor, index) =>
        createEmailDeliveryProcessor({
          repository: new WorkerEmailDeliveryRepository(executor),
          config,
          smtp: smtpConfig(),
          channel,
          workerId: `pg-worker-${index}`,
        }),
      );

      const processed = await Promise.all(processors.map((processor) => processor.processReady()));
      const rows = await firstExecutor.all(
        "SELECT status, content_envelope, content_purged_at FROM email_deliveries WHERE request_key = $1",
        [requestKey],
      );

      expect(processed.reduce((sum, count) => sum + count, 0)).toBe(1);
      expect(sent).toEqual([`<${suffix}@integration.local>`]);
      expect(rows[0]).toMatchObject({ status: "succeeded", content_envelope: null });
      expect(rows[0]?.content_purged_at).toBeTruthy();
    } finally {
      await firstExecutor.run(
        `DELETE FROM email_delivery_attempts WHERE delivery_id IN
         (SELECT id FROM email_deliveries WHERE request_key = $1)`,
        [requestKey],
      );
      await firstExecutor.run("DELETE FROM email_deliveries WHERE request_key = $1", [requestKey]);
      await firstExecutor.run("DELETE FROM users WHERE username = $1", [`worker-email-${suffix}`]);
      await Promise.all([firstExecutor.close(), secondExecutor.close()]);
    }
  });
});

function deliveryConfig(): EmailDeliveryConfig {
  return {
    enabled: true,
    concurrency: 1,
    maxAttempts: 5,
    retentionDays: 90,
    staleSeconds: 900,
    activeKeyId: "primary",
    contentKeys: new Map([["primary", Buffer.alloc(32, 3)]]),
  };
}

function smtpConfig() {
  return {
    enabled: true,
    host: "localhost",
    port: 1025,
    secure: false,
    allowInsecureLocalhost: true,
    username: null,
    password: null,
    from: "sender@example.com",
    timeoutMs: 1_000,
  } as const;
}

async function seed(
  executor: ReturnType<typeof createWorkerDatabaseExecutor>,
  suffix: string,
  config: EmailDeliveryConfig,
) {
  const now = new Date().toISOString();
  await executor.run(
    `INSERT INTO users
     (username, display_name, email, phone, password_hash, status,
      first_login_password_change_required, failed_login_attempts, token_version,
      is_deleted, created_at, updated_at)
     VALUES ($1, 'Worker Email', $2, $3, 'hash', 'enabled', FALSE, 0, 0, FALSE, $4, $5)`,
    [`worker-email-${suffix}`, `${suffix}@example.com`, suffix, now, now],
  );
  const users = await executor.all("SELECT id FROM users WHERE username = $1", [
    `worker-email-${suffix}`,
  ]);
  const userId = String(users[0]?.id);
  const requestKey = `worker-request-${suffix}`;
  const envelope = encryptEmailContent(
    { recipient: `${suffix}@example.com`, subject: "Subject", body: "Body" },
    "primary",
    config.contentKeys,
  );
  await executor.run(
    `INSERT INTO email_deliveries
     (request_key, request_fingerprint, user_id, template_id, template_code, locale,
      template_updated_at, masked_recipient, message_id, content_key_id, content_envelope,
      status, attempt, max_attempts, next_attempt_at, created_at, updated_at)
     VALUES ($1, 'fingerprint', $2, 1, 'worker.notice', 'en', $3, 'm***@example.com',
      $4, 'primary', $5, 'pending', 0, 5, $6, $7, $8)`,
    [requestKey, userId, now, `<${suffix}@integration.local>`, envelope, now, now, now],
  );
  return requestKey;
}

function requirePostgresqlUrl(): string {
  if (!postgresqlUrl) throw new Error("TEST_DATABASE_URL is required.");
  return postgresqlUrl;
}
