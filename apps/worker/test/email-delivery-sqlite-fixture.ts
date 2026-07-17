import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  encryptEmailContent,
  type DatabaseAdapterExecutor,
  type EmailDeliveryConfig,
} from "@web-admin-base/adapters";
import { runSqliteMigrations } from "@web-admin-base/db";

import { createWorkerDatabaseExecutor } from "../src/infra/worker-database-executor";

export type SqliteEmailDatabase = ReturnType<typeof createSqliteEmailDatabase>;

export function createSqliteEmailDatabase(name: string) {
  const filename = join(tmpdir(), `email-${name}-${process.pid}-${Date.now()}.sqlite`);
  const url = `file:${filename}`;
  runSqliteMigrations({ url });
  const executor = createWorkerDatabaseExecutor({ dialect: "sqlite", url });
  return {
    filename,
    executor,
    async close() {
      await executor.close();
      if (existsSync(filename)) rmSync(filename, { force: true });
    },
  };
}

export function sqliteEmailDeliveryConfig(): EmailDeliveryConfig {
  return {
    enabled: true,
    concurrency: 4,
    maxAttempts: 5,
    retentionDays: 90,
    staleSeconds: 900,
    activeKeyId: "primary",
    contentKeys: new Map([["primary", Buffer.alloc(32, 7)]]),
  };
}

export function smtpTestConfig() {
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

export async function seedSqliteEmailDelivery(
  executor: DatabaseAdapterExecutor,
  config: EmailDeliveryConfig,
) {
  const now = new Date().toISOString();
  await executor.run(
    `INSERT INTO users
     (username, display_name, email, phone, password_hash, status,
      first_login_password_change_required, failed_login_attempts, token_version,
      is_deleted, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'enabled', 0, 0, 0, 0, ?, ?)`,
    ["alice", "Alice", "a@example.com", "10001", "hash", now, now],
  );
  await executor.run(
    `INSERT INTO notification_templates
     (code, channel, locale, subject, body, variables_json, status, created_at, updated_at)
     VALUES ('notice', 'email', 'en', 'Subject', 'Body', '[]', 'enabled', ?, ?)`,
    [now, now],
  );
  const envelope = encryptEmailContent(
    { recipient: "a@example.com", subject: "Subject", body: "Body" },
    "primary",
    config.contentKeys,
  );
  await executor.run(
    `INSERT INTO email_deliveries
     (request_key, request_fingerprint, user_id, template_id, template_code, locale,
      template_updated_at, masked_recipient, message_id, content_key_id, content_envelope,
      status, attempt, max_attempts, next_attempt_at, created_at, updated_at)
     VALUES ('request-1', 'fingerprint', 1, 1, 'notice', 'en', ?, 'a***@example.com',
      '<stable@example.local>', 'primary', ?, 'pending', 0, 5, ?, ?, ?)`,
    [now, envelope, now, now, now],
  );
  const rows = await executor.all("SELECT id FROM email_deliveries LIMIT 1");
  return String(rows[0]?.id);
}

export async function seedAdditionalSqliteEmailDelivery(
  executor: DatabaseAdapterExecutor,
  config: EmailDeliveryConfig,
): Promise<void> {
  const now = new Date().toISOString();
  const envelope = encryptEmailContent(
    { recipient: "a@example.com", subject: "Subject 2", body: "Body 2" },
    "primary",
    config.contentKeys,
  );
  await executor.run(
    `INSERT INTO email_deliveries
     (request_key, request_fingerprint, user_id, template_id, template_code, locale,
      template_updated_at, masked_recipient, message_id, content_key_id, content_envelope,
      status, attempt, max_attempts, next_attempt_at, created_at, updated_at)
     VALUES ('request-2', 'fingerprint-2', 1, 1, 'notice', 'en', ?, 'a***@example.com',
      '<stable-2@example.local>', 'primary', ?, 'pending', 0, 5, ?, ?, ?)`,
    [now, envelope, now, now, now],
  );
}

export function rejectOverlappingTransactions(
  executor: DatabaseAdapterExecutor,
): DatabaseAdapterExecutor {
  let transactionActive = false;
  return {
    dialect: executor.dialect,
    all: executor.all,
    run: executor.run,
    close: executor.close,
    async transaction(operation) {
      if (transactionActive) throw new Error("Overlapping transaction detected.");
      transactionActive = true;
      try {
        return await executor.transaction(operation);
      } finally {
        transactionActive = false;
      }
    },
  };
}
