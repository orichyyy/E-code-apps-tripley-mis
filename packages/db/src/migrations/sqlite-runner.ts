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

  for (const migration of readMigrationFiles("sqlite")) {
    client.exec(migration.sql);
    applied.push(migration.name);
  }

  return applied;
}
