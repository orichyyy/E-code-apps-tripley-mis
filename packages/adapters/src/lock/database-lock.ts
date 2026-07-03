import { randomUUID } from "node:crypto";

import type { LockAdapter, LockHandle } from ".";
import type { DatabaseAdapterExecutor } from "../database/executor";
import { addSecondsIso, nowIso } from "../database/executor";

export function createDatabaseLockAdapter(
  executor: DatabaseAdapterExecutor,
  options: { owner?: string } = {}
): LockAdapter {
  const owner = options.owner ?? randomUUID();

  return {
    async acquire(key, acquireOptions) {
      return executor.transaction(async () => acquireLock(executor, key, owner, acquireOptions?.ttlSeconds ?? 30));
    },
    async healthCheck() {
      await executor.all("SELECT 1 AS ok");
      return { ok: true };
    }
  };
}

async function acquireLock(
  executor: DatabaseAdapterExecutor,
  key: string,
  owner: string,
  ttlSeconds: number
): Promise<LockHandle | null> {
  const now = nowIso();
  const expiresAt = addSecondsIso(ttlSeconds);
  const rows = await executor.all(`SELECT id, owner, fencing_token, expires_at FROM locks WHERE key = ${p(executor, 1)}`, [
    key
  ]);

  if (!rows[0]) {
    await executor.run(
      `INSERT INTO locks (key, owner, fencing_token, expires_at, heartbeat_at, created_at, updated_at)
       VALUES (${p(executor, 1)}, ${p(executor, 2)}, ${p(executor, 3)}, ${p(executor, 4)}, ${p(executor, 5)}, ${p(executor, 6)}, ${p(executor, 7)})`,
      [key, owner, 1, expiresAt, now, now, now]
    );
    return handle(executor, key, owner);
  }

  if (String(rows[0].owner) !== owner && String(rows[0].expires_at) > now) {
    return null;
  }

  await executor.run(
    `UPDATE locks SET owner = ${p(executor, 1)}, fencing_token = ${p(executor, 2)}, expires_at = ${p(executor, 3)}, heartbeat_at = ${p(executor, 4)}, updated_at = ${p(executor, 5)} WHERE key = ${p(executor, 6)}`,
    [owner, Number(rows[0].fencing_token) + 1, expiresAt, now, now, key]
  );
  return handle(executor, key, owner);
}

function handle(executor: DatabaseAdapterExecutor, key: string, owner: string): LockHandle {
  return {
    key,
    async release() {
      await executor.run(`DELETE FROM locks WHERE key = ${p(executor, 1)} AND owner = ${p(executor, 2)}`, [key, owner]);
    }
  };
}

function p(executor: DatabaseAdapterExecutor, index: number): string {
  return executor.dialect === "postgresql" ? `$${index}` : "?";
}
