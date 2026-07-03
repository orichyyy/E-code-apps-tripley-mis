import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { Pool } from "pg";
import { afterEach, describe, expect, it } from "vitest";

import {
  createSqliteClient,
  encodeOrgPath,
  runPostgresqlMigrations,
  runSqliteMigrations,
  runSqliteMigrationsWithClient
} from "../src";

const sqliteFilesToRemove: string[] = [];
const postgresqlUrl = process.env.TEST_DATABASE_URL;

afterEach(() => {
  for (const filename of sqliteFilesToRemove.splice(0)) {
    if (existsSync(filename)) {
      rmSync(filename, { force: true });
    }
  }
});

describe("database migration execution", () => {
  it("runs SQLite migrations against a local database file", () => {
    const filename = createTempSqliteFilename();
    const applied = runSqliteMigrations({ url: `file:${filename}` });
    const client = createSqliteClient(filename);

    try {
      const tables = client.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all();

      expect(applied).toEqual([
        "0001_backend_core_foundation.sql",
        "0002_permission_extension_persistence.sql"
      ]);
      expect(tables).toContainEqual({ name: "users" });
      expect(tables).toContainEqual({ name: "organizations" });
      expect(tables).toContainEqual({ name: "system_initialization_state" });
    } finally {
      client.close();
    }
  });

  it("preserves SQLite organization path values as bigint at the driver boundary", () => {
    const client = createSqliteClient(":memory:");
    const path = encodeOrgPath([127, 255, 255, 255, 255, 255, 255, 255]);

    try {
      runSqliteMigrationsWithClient(client);
      client
        .prepare(
          `INSERT INTO organizations (path, level, segment, name, code, created_at, updated_at)
           VALUES (?, 8, 255, 'Max Path Organization', 'max-path', '2026-07-03T00:00:00.000Z', '2026-07-03T00:00:00.000Z')`
        )
        .run(path);

      const row = client.prepare("SELECT path FROM organizations WHERE code = ?").get("max-path") as {
        path: bigint;
      };

      expect(row.path).toBe(path);
      expect(typeof row.path).toBe("bigint");
    } finally {
      client.close();
    }
  });

  it.runIf(postgresqlUrl)("runs PostgreSQL migrations against TEST_DATABASE_URL", async () => {
    const url = getPostgresqlUrl();
    const applied = await runPostgresqlMigrations({ url });
    const pool = new Pool({ connectionString: url });

    try {
      const result = await pool.query<{ table_name: string }>(
        `SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name IN ('users', 'organizations', 'system_initialization_state')
         ORDER BY table_name`
      );

      expect(applied).toEqual([
        "0001_backend_core_foundation.sql",
        "0002_permission_extension_persistence.sql"
      ]);
      expect(result.rows.map((row) => row.table_name)).toEqual([
        "organizations",
        "system_initialization_state",
        "users"
      ]);
    } finally {
      await pool.end();
    }
  });
});

function createTempSqliteFilename(): string {
  const filename = join(tmpdir(), `web-admin-base-${process.pid}-${Date.now()}-${Math.random()}.sqlite`);
  sqliteFilesToRemove.push(filename);

  return filename;
}

function getPostgresqlUrl(): string {
  if (!postgresqlUrl) {
    throw new Error("TEST_DATABASE_URL is required for PostgreSQL migration execution tests.");
  }

  return postgresqlUrl;
}
