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
  runSqliteMigrationsWithClient,
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
    const reapplied = runSqliteMigrations({ url: `file:${filename}` });
    const client = createSqliteClient(filename);

    try {
      const tables = client.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all();

      expect(applied).toEqual([
        "0001_backend_core_foundation.sql",
        "0002_permission_extension_persistence.sql",
        "0003_infrastructure_foundation.sql",
        "0004_system_dictionary_i18n.sql",
        "0005_announcements_webhooks.sql",
        "0006_file_references.sql",
        "0007_user_preferences.sql",
        "0008_file_object_locations.sql",
        "0009_webhook_delivery.sql",
        "0010_email_delivery.sql",
        "0011_announcement_targeting.sql",
      ]);
      expect(reapplied).toEqual([]);
      expect(tables).toContainEqual({ name: "users" });
      expect(tables).toContainEqual({ name: "organizations" });
      expect(tables).toContainEqual({ name: "system_initialization_state" });
      expect(tables).toContainEqual({ name: "queue_jobs" });
      expect(tables).toContainEqual({ name: "event_outbox" });
      expect(tables).toContainEqual({ name: "log_entries" });
      expect(tables).toContainEqual({ name: "system_configs" });
      expect(tables).toContainEqual({ name: "dictionary_types" });
      expect(tables).toContainEqual({ name: "dictionary_items" });
      expect(tables).toContainEqual({ name: "i18n_messages" });
      expect(tables).toContainEqual({ name: "announcements" });
      expect(tables).toContainEqual({ name: "announcement_targets" });
      expect(tables).toContainEqual({ name: "webhook_subscriptions" });
      expect(tables).toContainEqual({ name: "webhook_deliveries" });
      expect(tables).toContainEqual({ name: "webhook_delivery_attempts" });
      expect(tables).toContainEqual({ name: "email_deliveries" });
      expect(tables).toContainEqual({ name: "email_delivery_attempts" });
      expect(tables).toContainEqual({ name: "file_references" });
      expect(tables).toContainEqual({ name: "user_preferences" });
      const fileColumns = client.prepare("PRAGMA table_info(file_objects)").all() as Array<{
        name: string;
      }>;
      expect(fileColumns.map((column) => column.name)).toEqual(
        expect.arrayContaining(["storage_bucket", "content_deleted_at"]),
      );
      const subscriptionColumns = client
        .prepare("PRAGMA table_info(webhook_subscriptions)")
        .all() as Array<{ name: string }>;
      expect(subscriptionColumns.map((column) => column.name)).toContain("revision");
      const announcementColumns = client
        .prepare("PRAGMA table_info(announcements)")
        .all() as Array<{
        name: string;
      }>;
      expect(announcementColumns.map((column) => column.name)).toContain("expire_at");
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
           VALUES (?, 8, 255, 'Max Path Organization', 'max-path', '2026-07-03T00:00:00.000Z', '2026-07-03T00:00:00.000Z')`,
        )
        .run(path);

      const row = client
        .prepare("SELECT path FROM organizations WHERE code = ?")
        .get("max-path") as {
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
    const expectedMigrations = [
      "0001_backend_core_foundation.sql",
      "0002_permission_extension_persistence.sql",
      "0003_infrastructure_foundation.sql",
      "0004_system_dictionary_i18n.sql",
      "0005_announcements_webhooks.sql",
      "0006_file_references.sql",
      "0007_user_preferences.sql",
      "0008_file_object_locations.sql",
      "0009_webhook_delivery.sql",
      "0010_email_delivery.sql",
      "0011_announcement_targeting.sql",
    ];
    const applied = await runPostgresqlMigrations({ url });
    const reapplied = await runPostgresqlMigrations({ url });
    const pool = new Pool({ connectionString: url });

    try {
      const result = await pool.query<{ table_name: string }>(
        `SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name IN (
             'users',
             'organizations',
             'system_initialization_state',
             'queue_jobs',
             'event_outbox',
             'log_entries',
             'system_configs',
             'dictionary_types',
             'dictionary_items',
             'i18n_messages',
             'announcements',
             'file_references',
             'user_preferences',
             'webhook_subscriptions',
             'webhook_deliveries',
             'webhook_delivery_attempts',
             'email_deliveries',
             'email_delivery_attempts'
           )
         ORDER BY table_name`,
      );
      const columns = await pool.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'file_objects'`,
      );

      expect(applied.every((migration) => expectedMigrations.includes(migration))).toBe(true);
      expect(reapplied).toEqual([]);
      expect(columns.rows.map((row) => row.column_name)).toEqual(
        expect.arrayContaining(["storage_bucket", "content_deleted_at"]),
      );
      expect(result.rows.map((row) => row.table_name)).toEqual([
        "announcements",
        "dictionary_items",
        "dictionary_types",
        "email_deliveries",
        "email_delivery_attempts",
        "event_outbox",
        "file_references",
        "i18n_messages",
        "log_entries",
        "organizations",
        "queue_jobs",
        "system_configs",
        "system_initialization_state",
        "user_preferences",
        "users",
        "webhook_deliveries",
        "webhook_delivery_attempts",
        "webhook_subscriptions",
      ]);
    } finally {
      await pool.end();
    }
  });
});

function createTempSqliteFilename(): string {
  const filename = join(
    tmpdir(),
    `web-admin-base-${process.pid}-${Date.now()}-${Math.random()}.sqlite`,
  );
  sqliteFilesToRemove.push(filename);

  return filename;
}

function getPostgresqlUrl(): string {
  if (!postgresqlUrl) {
    throw new Error("TEST_DATABASE_URL is required for PostgreSQL migration execution tests.");
  }

  return postgresqlUrl;
}
