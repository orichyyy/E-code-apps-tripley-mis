import {
  decryptWebhookSecret,
  encryptWebhookSecret,
  isEncryptedWebhookSecret,
  loadWebhookDeliveryConfig,
  webhookSecretKeyId,
  type DatabaseAdapterExecutor,
  type DatabaseRow,
  type WebhookDeliveryConfig,
} from "@web-admin-base/adapters";
import { loadDatabaseConfig } from "@web-admin-base/db";
import { pathToFileURL } from "node:url";

import {
  createPostgresqlInfrastructureExecutor,
  createSqliteInfrastructureExecutor,
} from "./modules/infrastructure/infrastructure.executor";

export type WebhookSecretMigrationResult = {
  plaintext: number;
  oldKey: number;
  current: number;
  unreadable: number;
  changed: number;
};

export async function migrateWebhookSecrets(
  executor: DatabaseAdapterExecutor,
  config: WebhookDeliveryConfig,
  apply: boolean,
  report: (message: string) => void = console.log,
): Promise<WebhookSecretMigrationResult> {
  const activeKeyId = config.activeKeyId;
  if (!activeKeyId) throw new Error("WEBHOOK_SECRET_ACTIVE_KEY_ID is required.");
  const result: WebhookSecretMigrationResult = {
    plaintext: 0,
    oldKey: 0,
    current: 0,
    unreadable: 0,
    changed: 0,
  };
  let afterId = "0";
  while (true) {
    const rows = await executor.all(
      `SELECT id, secret FROM webhook_subscriptions
       WHERE secret IS NOT NULL AND id > ${p(executor, 1)} ORDER BY id ASC LIMIT 100`,
      [afterId],
    );
    if (rows.length === 0) break;
    if (apply)
      await executor.transaction(() => processBatch(executor, config, rows, result, report));
    else await inspectBatch(config, rows, result, report);
    afterId = String(rows.at(-1)?.id);
  }
  return result;
}

async function processBatch(
  executor: DatabaseAdapterExecutor,
  config: WebhookDeliveryConfig,
  rows: DatabaseRow[],
  result: WebhookSecretMigrationResult,
  report: (message: string) => void,
): Promise<void> {
  const activeKeyId = config.activeKeyId as string;
  for (const row of rows) {
    const inspected = inspectSecret(String(row.secret), config, result);
    report(`webhook subscription ${String(row.id)}: ${inspected.status}`);
    if (!inspected.plaintext) continue;
    const encrypted = encryptWebhookSecret(inspected.plaintext, activeKeyId, config.secretKeys);
    await executor.run(
      `UPDATE webhook_subscriptions SET secret = ${p(executor, 1)}, updated_at = ${p(executor, 2)}
       WHERE id = ${p(executor, 3)}`,
      [encrypted, new Date().toISOString(), row.id],
    );
    result.changed += 1;
  }
}

async function inspectBatch(
  config: WebhookDeliveryConfig,
  rows: DatabaseRow[],
  result: WebhookSecretMigrationResult,
  report: (message: string) => void,
): Promise<void> {
  for (const row of rows) {
    const inspected = inspectSecret(String(row.secret), config, result);
    report(`webhook subscription ${String(row.id)}: ${inspected.status}`);
  }
}

function inspectSecret(
  secret: string,
  config: WebhookDeliveryConfig,
  result: WebhookSecretMigrationResult,
) {
  if (!isEncryptedWebhookSecret(secret)) {
    result.plaintext += 1;
    return { status: "plaintext", plaintext: secret };
  }
  try {
    const plaintext = decryptWebhookSecret(secret, config.secretKeys);
    if (webhookSecretKeyId(secret) === config.activeKeyId) {
      result.current += 1;
      return { status: "current", plaintext: null };
    }
    result.oldKey += 1;
    return { status: "old-key", plaintext };
  } catch {
    result.unreadable += 1;
    return { status: "unreadable", plaintext: null };
  }
}

function p(executor: DatabaseAdapterExecutor, index: number): string {
  return executor.dialect === "postgresql" ? `$${index}` : "?";
}

async function main(): Promise<void> {
  const database = loadDatabaseConfig();
  const executor =
    database.dialect === "postgresql"
      ? createPostgresqlInfrastructureExecutor(database.url)
      : createSqliteInfrastructureExecutor(database.url);
  try {
    const apply = process.argv.includes("--apply");
    const result = await migrateWebhookSecrets(executor, loadWebhookDeliveryConfig(), apply);
    console.log(JSON.stringify({ mode: apply ? "apply" : "scan", ...result }));
    if (result.unreadable > 0) process.exitCode = 1;
  } finally {
    await executor.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
