import type { Pool } from "pg";

import { createPostgresqlPool } from "../connection/postgresql";
import { collectMigrationFiles } from "./migration-files";
import type { BusinessModuleMigrationSource } from "./module-migration-source";

export type PostgresqlMigrationOptions = {
  url: string;
  moduleSources?: readonly BusinessModuleMigrationSource[];
};

export async function runPostgresqlMigrations(
  options: PostgresqlMigrationOptions,
): Promise<string[]> {
  const pool = createPostgresqlPool(options.url);

  try {
    return await runPostgresqlMigrationsWithPool(pool, options.moduleSources);
  } finally {
    await pool.end();
  }
}

export async function runPostgresqlMigrationsWithPool(
  pool: Pool,
  moduleSources?: readonly BusinessModuleMigrationSource[],
): Promise<string[]> {
  const applied: string[] = [];
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    checksum TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL
  )`);
  await assertPostgresqlMigrationHistoryShape(pool);

  for (const migration of collectMigrationFiles("postgresql", moduleSources)) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query<{ source: string; checksum: string }>(
        "SELECT source, checksum FROM schema_migrations WHERE name = $1",
        [migration.id],
      );
      if (existing.rowCount === 0) {
        await client.query(migration.sql);
        await client.query(
          "INSERT INTO schema_migrations (name, source, checksum, applied_at) VALUES ($1, $2, $3, $4)",
          [migration.id, migration.source, migration.checksum, new Date().toISOString()],
        );
        applied.push(migration.id);
      } else {
        assertAppliedMigration(existing.rows[0]!, migration);
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

async function assertPostgresqlMigrationHistoryShape(pool: Pool): Promise<void> {
  const result = await pool.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = 'schema_migrations'`,
  );
  const columns = new Set(result.rows.map(({ column_name }) => column_name));
  if (!columns.has("source") || !columns.has("checksum")) {
    throw new Error(
      "Legacy schema_migrations shape detected. Rebuild the development/test database before running migrations.",
    );
  }
}

function assertAppliedMigration(
  existing: { source: string; checksum: string },
  migration: { id: string; source: string; checksum: string },
): void {
  if (existing.source !== migration.source || existing.checksum !== migration.checksum) {
    throw new Error(
      `Applied migration ${migration.id} differs from its registered source or SHA-256 checksum. Migrations are append-only.`,
    );
  }
}
