import { pathToFileURL } from "node:url";

import {
  decryptEmailContent,
  emailContentKeyId,
  encryptEmailContent,
  loadEmailDeliveryConfig,
  type DatabaseAdapterExecutor,
  type EmailDeliveryConfig,
} from "@web-admin-base/adapters";
import { loadDatabaseConfig } from "@web-admin-base/db";

import {
  createPostgresqlInfrastructureExecutor,
  createSqliteInfrastructureExecutor,
} from "./modules/infrastructure/infrastructure.executor";

export type EmailContentKeyMigrationResult = {
  current: number;
  oldKey: number;
  unavailable: number;
  corrupted: number;
  changed: number;
};

export async function migrateEmailContentKeys(
  executor: DatabaseAdapterExecutor,
  config: EmailDeliveryConfig,
  apply: boolean,
  report: (message: string) => void = console.log,
): Promise<EmailContentKeyMigrationResult> {
  const activeKeyId = config.activeKeyId;
  if (!activeKeyId || !config.contentKeys.has(activeKeyId)) {
    throw new Error("EMAIL_CONTENT_ACTIVE_KEY_ID must reference an available content key.");
  }
  const result: EmailContentKeyMigrationResult = {
    current: 0,
    oldKey: 0,
    unavailable: 0,
    corrupted: 0,
    changed: 0,
  };
  const rows = await executor.all(
    `SELECT id, content_key_id, content_envelope FROM email_deliveries
     WHERE status IN ('pending', 'running') AND content_envelope IS NOT NULL ORDER BY id ASC`,
  );
  for (const row of rows) {
    const id = String(row.id);
    const keyId = String(
      row.content_key_id ?? emailContentKeyId(String(row.content_envelope)) ?? "",
    );
    if (!config.contentKeys.has(keyId)) {
      result.unavailable += 1;
      report(`email delivery ${id}: unavailable-key`);
      continue;
    }
    try {
      const snapshot = decryptEmailContent(String(row.content_envelope), config.contentKeys);
      if (keyId === activeKeyId) {
        result.current += 1;
        report(`email delivery ${id}: current`);
        continue;
      }
      result.oldKey += 1;
      report(`email delivery ${id}: old-key`);
      if (!apply) continue;
      const envelope = encryptEmailContent(snapshot, activeKeyId, config.contentKeys);
      await executor.run(
        `UPDATE email_deliveries SET content_key_id = ${p(executor, 1)},
         content_envelope = ${p(executor, 2)}, updated_at = ${p(executor, 3)}
         WHERE id = ${p(executor, 4)} AND status IN ('pending', 'running')`,
        [activeKeyId, envelope, new Date().toISOString(), id],
      );
      result.changed += 1;
    } catch {
      result.corrupted += 1;
      report(`email delivery ${id}: corrupted`);
    }
  }
  return result;
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
    const result = await migrateEmailContentKeys(executor, loadEmailDeliveryConfig(), apply);
    console.log(JSON.stringify({ mode: apply ? "apply" : "scan", ...result }));
    if (result.unavailable > 0 || result.corrupted > 0) process.exitCode = 1;
  } finally {
    await executor.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
