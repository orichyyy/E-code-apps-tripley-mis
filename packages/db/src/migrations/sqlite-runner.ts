import type Database from "better-sqlite3";

import { createSqliteClient } from "../connection/sqlite";
import { readMigrationFiles } from "./migration-files";

export type SqliteMigrationOptions = {
  url: string;
};

export function runSqliteMigrations(options: SqliteMigrationOptions): string[] {
  const client = createSqliteClient(options.url);

  try {
    return runSqliteMigrationsWithClient(client);
  } finally {
    client.close();
  }
}

export function runSqliteMigrationsWithClient(client: Database.Database): string[] {
  const applied: string[] = [];
  client.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`);
  const hasMigration = client.prepare("SELECT name FROM schema_migrations WHERE name = ?");
  const recordMigration = client.prepare(
    "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
  );

  for (const migration of readMigrationFiles("sqlite")) {
    if (hasMigration.get(migration.name)) continue;
    client.transaction(() => {
      client.exec(migration.sql);
      recordMigration.run(migration.name, new Date().toISOString());
    })();
    applied.push(migration.name);
  }

  return applied;
}
