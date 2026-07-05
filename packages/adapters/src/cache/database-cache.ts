import type { CacheAdapter } from ".";
import type { DatabaseAdapterExecutor } from "../database/executor";
import { jsonParam, nowIso, param, readJson } from "../database/executor";

export function createDatabaseCacheAdapter(executor: DatabaseAdapterExecutor): CacheAdapter {
  return {
    async get(key) {
      const now = nowIso();
      const rows = await executor.all(
        `SELECT value_json FROM cache_entries WHERE key = ${p(executor.dialect, 1)} AND (expires_at IS NULL OR expires_at > ${p(executor.dialect, 2)})`,
        [key, now],
      );
      if (!rows[0]) return null;
      return readJson(rows[0].value_json);
    },
    async set(key, value, options) {
      const now = nowIso();
      const expiresAt = options?.ttlSeconds
        ? new Date(Date.now() + options.ttlSeconds * 1000).toISOString()
        : null;
      await executor.run(
        upsertSql(executor.dialect),
        [key, jsonParam(value, executor.dialect), expiresAt, now, now].map(param),
      );
    },
    async delete(key) {
      await executor.run(
        `DELETE FROM cache_entries WHERE key = ${executor.dialect === "postgresql" ? "$1" : "?"}`,
        [key],
      );
    },
    async healthCheck() {
      await executor.all("SELECT 1 AS ok");
      return { ok: true };
    },
  };
}

function upsertSql(dialect: DatabaseAdapterExecutor["dialect"]): string {
  const p = (index: number) => (dialect === "postgresql" ? `$${index}` : "?");
  return `INSERT INTO cache_entries (key, value_json, expires_at, created_at, updated_at)
    VALUES (${p(1)}, ${p(2)}, ${p(3)}, ${p(4)}, ${p(5)})
    ON CONFLICT (key) DO UPDATE SET value_json = excluded.value_json, expires_at = excluded.expires_at, updated_at = excluded.updated_at`;
}

function p(dialect: DatabaseAdapterExecutor["dialect"], index: number): string {
  return dialect === "postgresql" ? `$${index}` : "?";
}
