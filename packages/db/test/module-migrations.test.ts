import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import { Pool } from "pg";

import {
  collectMigrationFiles,
  createSqliteClient,
  runSqliteMigrationsWithClient,
  runPostgresqlMigrations,
  validateBusinessModuleMigrationSources,
  type BusinessModuleMigrationSource,
} from "../src";

const fixturesRoot = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const postgresqlUrl = process.env.TEST_DATABASE_URL;

function fixtureSource(name: string): BusinessModuleMigrationSource {
  const root = join(fixturesRoot, name);
  return {
    moduleCode: "fixture-orders",
    sqliteDirectory: join(root, "sqlite"),
    postgresqlDirectory: join(root, "postgresql"),
  };
}

describe("Business Module migration sources", () => {
  it("orders base migrations first and creates namespaced checksummed module IDs", () => {
    const migrations = collectMigrationFiles("sqlite", [fixtureSource("valid-module")]);
    const moduleMigration = migrations.at(-1);

    expect(migrations[0]?.source).toBe("base-system");
    expect(moduleMigration).toMatchObject({
      id: "module:fixture-orders:0001_create_orders",
      logicalId: "0001_create_orders",
      source: "fixture-orders",
    });
    expect(moduleMigration?.checksum).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects dialect migration ID mismatches", () => {
    expect(() => validateBusinessModuleMigrationSources([fixtureSource("invalid-parity")])).toThrow(
      /matching logical migration IDs/,
    );
  });

  it("rejects migration sources outside the Module Code namespace", () => {
    expect(() =>
      validateBusinessModuleMigrationSources([
        { ...fixtureSource("valid-module"), moduleCode: "FixtureOrders" },
      ]),
    ).toThrow(/lower kebab-case Module Code/);
  });

  it("executes registered module migrations and records source/checksum", () => {
    const client = createSqliteClient(":memory:");
    try {
      runSqliteMigrationsWithClient(client, [fixtureSource("valid-module")]);
      const row = client
        .prepare("SELECT name, source, checksum FROM schema_migrations WHERE source = ?")
        .get("fixture-orders") as { name: string; source: string; checksum: string };

      expect(row.name).toBe("module:fixture-orders:0001_create_orders");
      expect(row.source).toBe("fixture-orders");
      expect(row.checksum).toMatch(/^[a-f0-9]{64}$/);
    } finally {
      client.close();
    }
  });

  it("rejects changes to an applied migration checksum", () => {
    const client = createSqliteClient(":memory:");
    try {
      runSqliteMigrationsWithClient(client, [fixtureSource("valid-module")]);
      client
        .prepare("UPDATE schema_migrations SET checksum = ? WHERE source = ?")
        .run("0".repeat(64), "fixture-orders");

      expect(() => runSqliteMigrationsWithClient(client, [fixtureSource("valid-module")])).toThrow(
        /append-only/,
      );
    } finally {
      client.close();
    }
  });

  it("fails clearly for the legacy migration history shape", () => {
    const client = createSqliteClient(":memory:");
    client.exec("CREATE TABLE schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
    try {
      expect(() => runSqliteMigrationsWithClient(client)).toThrow(
        /rebuild the development\/test database/i,
      );
    } finally {
      client.close();
    }
  });

  it.runIf(postgresqlUrl)("persists module migration history in PostgreSQL", async () => {
    const url = postgresqlUrl!;
    await runPostgresqlMigrations({ url, moduleSources: [fixtureSource("valid-module")] });
    const pool = new Pool({ connectionString: url });
    try {
      const result = await pool.query<{ name: string; source: string; checksum: string }>(
        "SELECT name, source, checksum FROM schema_migrations WHERE source = $1",
        ["fixture-orders"],
      );
      expect(result.rows[0]).toMatchObject({
        name: "module:fixture-orders:0001_create_orders",
        source: "fixture-orders",
      });
      expect(result.rows[0]?.checksum).toMatch(/^[a-f0-9]{64}$/);
    } finally {
      await pool.end();
    }
  });
});
