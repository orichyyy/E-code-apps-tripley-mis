import type { RateLimitAdapter, RateLimitResult } from ".";
import type { DatabaseAdapterExecutor } from "../database/executor";
import { nowIso } from "../database/executor";

export function createDatabaseRateLimitAdapter(
  executor: DatabaseAdapterExecutor,
): RateLimitAdapter {
  return {
    async check(key, limit, windowSeconds) {
      return executor.transaction(async () =>
        checkWithinTransaction(executor, key, limit, windowSeconds),
      );
    },
    async healthCheck() {
      await executor.all("SELECT 1 AS ok");
      return { ok: true };
    },
  };
}

async function checkWithinTransaction(
  executor: DatabaseAdapterExecutor,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const nowMs = Date.now();
  const windowStartsAt = new Date(
    Math.floor(nowMs / (windowSeconds * 1000)) * windowSeconds * 1000,
  ).toISOString();
  const expiresAt = new Date(Date.parse(windowStartsAt) + windowSeconds * 1000).toISOString();
  const rows = await executor.all(
    `SELECT id, count FROM rate_limit_counters WHERE key = ${p(executor, 1)} AND window_starts_at = ${p(executor, 2)}`,
    [key, windowStartsAt],
  );
  const count = rows[0] ? Number(rows[0].count) + 1 : 1;

  if (rows[0]) {
    await executor.run(
      `UPDATE rate_limit_counters SET count = ${p(executor, 1)}, updated_at = ${p(executor, 2)} WHERE id = ${p(executor, 3)}`,
      [count, nowIso(), rows[0].id],
    );
  } else {
    await executor.run(
      `INSERT INTO rate_limit_counters (key, window_starts_at, window_seconds, count, expires_at, created_at, updated_at)
       VALUES (${p(executor, 1)}, ${p(executor, 2)}, ${p(executor, 3)}, ${p(executor, 4)}, ${p(executor, 5)}, ${p(executor, 6)}, ${p(executor, 7)})`,
      [key, windowStartsAt, windowSeconds, count, expiresAt, nowIso(), nowIso()],
    );
  }

  return {
    allowed: count <= limit,
    remaining: Math.max(limit - count, 0),
    resetAt: expiresAt,
  };
}

function p(executor: DatabaseAdapterExecutor, index: number): string {
  return executor.dialect === "postgresql" ? `$${index}` : "?";
}
