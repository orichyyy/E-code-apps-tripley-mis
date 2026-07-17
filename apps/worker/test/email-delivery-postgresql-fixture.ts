import { randomUUID } from "node:crypto";

import { encryptEmailContent, type EmailDeliveryConfig } from "@web-admin-base/adapters";
import { runPostgresqlMigrations } from "@web-admin-base/db";

import { createWorkerDatabaseExecutor } from "../src/infra/worker-database-executor";

export type PostgresqlEmailFixture = Awaited<ReturnType<typeof createPostgresqlEmailFixture>>;

export async function createPostgresqlEmailFixture(url: string) {
  await runPostgresqlMigrations({ url });
  const executor = createWorkerDatabaseExecutor({ dialect: "postgresql", url });
  const suffix = randomUUID();
  const config = emailDeliveryTestConfig();
  let sequence = 0;

  async function seed(input: SeedEmailDelivery = {}) {
    sequence += 1;
    const token = `${suffix}-${sequence}`;
    const now = input.createdAt ?? new Date().toISOString();
    const username = `email-lifecycle-${token}`;
    await executor.run(
      `INSERT INTO users
       (username, display_name, email, phone, password_hash, status,
        first_login_password_change_required, failed_login_attempts, token_version,
        is_deleted, deleted_at, created_at, updated_at)
       VALUES ($1, 'Email Lifecycle', $2, $3, 'hash', 'enabled', FALSE, 0, 0,
        $4, $5, $6, $7)`,
      [
        username,
        `${token}@example.com`,
        token,
        input.deleted ?? false,
        input.deleted ? now : null,
        now,
        now,
      ],
    );
    const users = await executor.all("SELECT id FROM users WHERE username = $1", [username]);
    const userId = String(users[0]?.id);
    const requestKey = `email-lifecycle-${token}`;
    const keyId = input.keyId === undefined ? "primary" : input.keyId;
    const envelope = resolveEnvelope(input, config, token);
    await executor.run(
      `INSERT INTO email_deliveries
       (request_key, request_fingerprint, user_id, template_id, template_code, locale,
        template_updated_at, masked_recipient, message_id, content_key_id, content_envelope,
        status, attempt, max_attempts, next_attempt_at, locked_by, locked_at,
        created_at, updated_at, succeeded_at, content_purged_at)
       VALUES ($1, 'fingerprint', $2, 1, 'worker.notice', 'en', $3,
        'e***@example.com', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        requestKey,
        userId,
        now,
        `<${token}@integration.local>`,
        keyId,
        envelope,
        input.status ?? "pending",
        input.attempt ?? 0,
        input.maxAttempts ?? 5,
        input.nextAttemptAt ?? now,
        input.lockedAt ? "stale-worker" : null,
        input.lockedAt ?? null,
        now,
        now,
        input.status === "succeeded" ? now : null,
        input.status === "succeeded" ? now : null,
      ],
    );
    const deliveries = await executor.all(
      "SELECT id FROM email_deliveries WHERE request_key = $1",
      [requestKey],
    );
    return { id: String(deliveries[0]?.id), requestKey, userId };
  }

  async function close() {
    await executor.run(
      `DELETE FROM email_delivery_attempts WHERE delivery_id IN
       (SELECT id FROM email_deliveries WHERE request_key LIKE $1)`,
      [`email-lifecycle-${suffix}-%`],
    );
    await executor.run("DELETE FROM email_deliveries WHERE request_key LIKE $1", [
      `email-lifecycle-${suffix}-%`,
    ]);
    await executor.run("DELETE FROM users WHERE username LIKE $1", [`email-lifecycle-${suffix}-%`]);
    await executor.close();
  }

  return { executor, config, suffix, seed, close };
}

export function emailDeliveryTestConfig(): EmailDeliveryConfig {
  return {
    enabled: true,
    concurrency: 4,
    maxAttempts: 5,
    retentionDays: 90,
    staleSeconds: 60,
    activeKeyId: "primary",
    contentKeys: new Map([["primary", Buffer.alloc(32, 3)]]),
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

type SeedEmailDelivery = {
  status?: "pending" | "running" | "succeeded";
  attempt?: number;
  maxAttempts?: number;
  nextAttemptAt?: string;
  lockedAt?: string;
  createdAt?: string;
  deleted?: boolean;
  keyId?: string | null;
  envelope?: string | null;
};

function resolveEnvelope(
  input: SeedEmailDelivery,
  config: EmailDeliveryConfig,
  token: string,
): string | null {
  if ("envelope" in input) return input.envelope ?? null;
  if (input.status === "succeeded") return null;
  const keyId = input.keyId ?? "primary";
  if (!config.contentKeys.has(keyId)) return `email:v1:${keyId}:missing:missing:missing`;
  return encryptEmailContent(
    { recipient: `${token}@example.com`, subject: "Subject", body: "Body" },
    keyId,
    config.contentKeys,
  );
}
