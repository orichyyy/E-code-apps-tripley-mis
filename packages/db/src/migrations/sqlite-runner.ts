import type Database from "better-sqlite3";

import { createSqliteClient } from "../connection/sqlite";
import { collectMigrationFiles } from "./migration-files";
import type { BusinessModuleMigrationSource } from "./module-migration-source";

export type SqliteMigrationOptions = {
  url: string;
  moduleSources?: readonly BusinessModuleMigrationSource[];
};

export function runSqliteMigrations(options: SqliteMigrationOptions): string[] {
  const client = createSqliteClient(options.url);

  try {
    return runSqliteMigrationsWithClient(client, options.moduleSources);
  } finally {
    client.close();
  }
}

export function runSqliteMigrationsWithClient(
  client: Database.Database,
  moduleSources?: readonly BusinessModuleMigrationSource[],
): string[] {
  const applied: string[] = [];
  client.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    checksum TEXT NOT NULL,
    applied_at TEXT NOT NULL
  )`);
  assertSqliteMigrationHistoryShape(client);
  const findMigration = client.prepare(
    "SELECT name, source, checksum FROM schema_migrations WHERE name = ?",
  );
  const recordMigration = client.prepare(
    "INSERT INTO schema_migrations (name, source, checksum, applied_at) VALUES (?, ?, ?, ?)",
  );

  for (const migration of collectMigrationFiles("sqlite", moduleSources)) {
    const existing = findMigration.get(migration.id) as
      { name: string; source: string; checksum: string } | undefined;
    if (existing) {
      assertAppliedMigration(existing, migration);
      continue;
    }
    client.transaction(() => {
      client.exec(migration.sql);
      recordMigration.run(
        migration.id,
        migration.source,
        migration.checksum,
        new Date().toISOString(),
      );
    })();
    applied.push(migration.id);
  }

  return applied;
}

function assertSqliteMigrationHistoryShape(client: Database.Database): void {
  const columns = client.prepare("PRAGMA table_info(schema_migrations)").all() as Array<{
    name: string;
  }>;
  const names = new Set(columns.map(({ name }) => name));
  if (!names.has("source") || !names.has("checksum")) {
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
