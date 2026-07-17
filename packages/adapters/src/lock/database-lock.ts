import { randomUUID } from "node:crypto";

import type { LockAdapter, LockHandle } from ".";
import type { DatabaseAdapterExecutor } from "../database/executor";
import { addSecondsIso, nowIso } from "../database/executor";

export function createDatabaseLockAdapter(
  executor: DatabaseAdapterExecutor,
  options: { owner?: string } = {},
): LockAdapter {
  const owner = options.owner ?? randomUUID();

  return {
    async acquire(key, acquireOptions) {
      return executor.transaction(async () =>
        acquireLock(executor, key, owner, acquireOptions?.ttlSeconds ?? 30),
      );
    },
    async healthCheck() {
      await executor.all("SELECT 1 AS ok");
      return { ok: true };
    },
  };
}

async function acquireLock(
  executor: DatabaseAdapterExecutor,
  key: string,
  owner: string,
  ttlSeconds: number,
): Promise<LockHandle | null> {
  const now = nowIso();
  const expiresAt = addSecondsIso(ttlSeconds);
  if (await insertIfAbsent(executor, key, owner, expiresAt, now)) {
    return handle(executor, key, owner);
  }
  if (await takeExpiredOrOwned(executor, key, owner, expiresAt, now)) {
    return handle(executor, key, owner);
  }
  return null;
}

async function insertIfAbsent(
  executor: DatabaseAdapterExecutor,
  key: string,
  owner: string,
  expiresAt: string,
  now: string,
): Promise<boolean> {
  const values = [key, owner, 1, expiresAt, now, now, now];
  if (executor.dialect === "postgresql") {
    const rows = await executor.all(
      `INSERT INTO locks (key, owner, fencing_token, expires_at, heartbeat_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4::timestamptz, $5::timestamptz, $6::timestamptz, $7::timestamptz)
       ON CONFLICT (key) DO NOTHING RETURNING key`,
      values,
    );
    return rows.length === 1;
  }
  await executor.run(
    `INSERT OR IGNORE INTO locks
     (key, owner, fencing_token, expires_at, heartbeat_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    values,
  );
  return Number((await executor.all("SELECT changes() AS count"))[0]?.count ?? 0) === 1;
}

async function takeExpiredOrOwned(
  executor: DatabaseAdapterExecutor,
  key: string,
  owner: string,
  expiresAt: string,
  now: string,
): Promise<boolean> {
  if (executor.dialect === "postgresql") {
    const rows = await executor.all(
      `UPDATE locks SET owner = $1, fencing_token = fencing_token + 1,
       expires_at = $2::timestamptz, heartbeat_at = $3::timestamptz, updated_at = $4::timestamptz
       WHERE key = $5 AND (owner = $1 OR expires_at <= $3::timestamptz) RETURNING key`,
      [owner, expiresAt, now, now, key],
    );
    return rows.length === 1;
  }
  await executor.run(
    `UPDATE locks SET owner = ?, fencing_token = fencing_token + 1,
     expires_at = ?, heartbeat_at = ?, updated_at = ?
     WHERE key = ? AND (owner = ? OR expires_at <= ?)`,
    [owner, expiresAt, now, now, key, owner, now],
  );
  return Number((await executor.all("SELECT changes() AS count"))[0]?.count ?? 0) === 1;
}

function handle(executor: DatabaseAdapterExecutor, key: string, owner: string): LockHandle {
  return {
    key,
    async release() {
      await executor.run(
        `DELETE FROM locks WHERE key = ${p(executor, 1)} AND owner = ${p(executor, 2)}`,
        [key, owner],
      );
    },
  };
}

function p(executor: DatabaseAdapterExecutor, index: number): string {
  return executor.dialect === "postgresql" ? `$${index}` : "?";
}
