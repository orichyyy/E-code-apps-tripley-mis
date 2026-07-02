import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { sqliteSchema } from "../schema/sqlite";

export type SqliteDatabase = ReturnType<typeof createSqliteDatabase>;

export function createSqliteDatabase(url: string) {
  const client = createSqliteClient(url);

  return drizzle(client, { schema: sqliteSchema });
}

export function createSqliteClient(url: string): Database.Database {
  const filename = getSqliteFilename(url);
  ensureSqliteDirectory(filename);

  const client = new Database(filename);
  client.defaultSafeIntegers(true);

  return client;
}

export function getSqliteFilename(url: string): string {
  if (url === ":memory:" || url === "file::memory:") {
    return ":memory:";
  }

  return url.startsWith("file:") ? url.slice("file:".length) : url;
}

function ensureSqliteDirectory(filename: string): void {
  if (filename === ":memory:") {
    return;
  }

  mkdirSync(dirname(resolve(filename)), { recursive: true });
}
