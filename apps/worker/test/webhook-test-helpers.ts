import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  jsonParam,
  type DatabaseAdapterExecutor,
  type WebhookDeliveryConfig,
} from "@web-admin-base/adapters";
import { runSqliteMigrations } from "@web-admin-base/db";

import { createWorkerDatabaseExecutor } from "../src/infra/worker-database-executor";

export type WebhookTestDatabase = {
  executor: DatabaseAdapterExecutor;
  close(): Promise<void>;
};

export function createWebhookTestDatabase(name: string): WebhookTestDatabase {
  const filename = join(tmpdir(), `webhook-${name}-${process.pid}-${Date.now()}.sqlite`);
  const url = `file:${filename}`;
  runSqliteMigrations({ url });
  const executor = createWorkerDatabaseExecutor({ dialect: "sqlite", url });
  return {
    executor,
    async close() {
      await executor.close();
      if (existsSync(filename)) rmSync(filename, { force: true });
    },
  };
}

export function webhookTestConfig(overrides: Partial<WebhookDeliveryConfig> = {}) {
  return {
    enabled: true,
    eventSource: "test.admin",
    requestTimeoutMs: 1_000,
    maxAttempts: 5,
    concurrency: 4,
    retentionDays: 90,
    allowedHosts: new Set<string>(),
    allowInsecureLocalhost: true,
    secretKeys: new Map<string, Uint8Array>(),
    activeKeyId: null,
    ...overrides,
  } satisfies WebhookDeliveryConfig;
}

export async function seedSubscription(
  executor: DatabaseAdapterExecutor,
  input: { name: string; url: string; eventTypes?: string[]; revision?: number },
): Promise<string> {
  const now = new Date().toISOString();
  await executor.run(
    `INSERT INTO webhook_subscriptions
     (name, url, event_types, revision, status, is_deleted, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'enabled', 0, ?, ?)`,
    [
      input.name,
      input.url,
      jsonParam(input.eventTypes ?? ["user.created"], "sqlite"),
      input.revision ?? 1,
      now,
      now,
    ],
  );
  const rows = await executor.all("SELECT last_insert_rowid() AS id");
  return String(rows[0]?.id);
}

export async function seedOutboxEvent(
  executor: DatabaseAdapterExecutor,
  event: Record<string, unknown>,
  eventType = "user.created",
  status = "pending",
  occurredAt = new Date().toISOString(),
): Promise<string> {
  await executor.run(
    `INSERT INTO event_outbox
     (event_type, payload_json, status, attempt, max_attempts, occurred_at, created_at, updated_at)
     VALUES (?, ?, ?, 0, 1, ?, ?, ?)`,
    [eventType, jsonParam(event, "sqlite"), status, occurredAt, occurredAt, occurredAt],
  );
  const rows = await executor.all("SELECT last_insert_rowid() AS id");
  return String(rows[0]?.id);
}

export function userCreatedEvent(occurredAt = new Date().toISOString()) {
  return {
    subject: "users/42",
    occurredAt,
    data: { userId: "42", primaryOrganizationId: "1", createdByUserId: "1" },
  };
}
