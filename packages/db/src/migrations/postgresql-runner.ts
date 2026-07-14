import type { Pool } from "pg";

import { createPostgresqlPool } from "../connection/postgresql";
import { readMigrationFiles } from "./migration-files";

export type PostgresqlMigrationOptions = {
  url: string;
};

export async function runPostgresqlMigrations(
  options: PostgresqlMigrationOptions,
): Promise<string[]> {
  const pool = createPostgresqlPool(options.url);

  try {
    return await runPostgresqlMigrationsWithPool(pool);
  } finally {
    await pool.end();
  }
}

export async function runPostgresqlMigrationsWithPool(pool: Pool): Promise<string[]> {
  const applied: string[] = [];
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL
  )`);

  for (const migration of readMigrationFiles("postgresql")) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query("SELECT name FROM schema_migrations WHERE name = $1", [
        migration.name,
      ]);
      if (existing.rowCount === 0) {
        await client.query(migration.sql);
        await client.query("INSERT INTO schema_migrations (name, applied_at) VALUES ($1, $2)", [
          migration.name,
          new Date().toISOString(),
        ]);
        applied.push(migration.name);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  return applied;
}
