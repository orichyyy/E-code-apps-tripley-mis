import type { Pool } from "pg";

import { createPostgresqlPool } from "../connection/postgresql";
import { readMigrationFiles } from "./migration-files";

export type PostgresqlMigrationOptions = {
  url: string;
};

export async function runPostgresqlMigrations(options: PostgresqlMigrationOptions): Promise<string[]> {
  const pool = createPostgresqlPool(options.url);

  try {
    return await runPostgresqlMigrationsWithPool(pool);
  } finally {
    await pool.end();
  }
}

export async function runPostgresqlMigrationsWithPool(pool: Pool): Promise<string[]> {
  const applied: string[] = [];

  for (const migration of readMigrationFiles("postgresql")) {
    await pool.query(migration.sql);
    applied.push(migration.name);
  }

  return applied;
}
