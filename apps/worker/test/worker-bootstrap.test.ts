import { existsSync, rmSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  createDatabaseQueueAdapter,
  createLocalFileStorageAdapter,
  type DatabaseAdapterExecutor,
  readJson
} from "@web-admin-base/adapters";
import {
  inAppNotificationDispatchJobType,
  type InAppNotificationDispatchPayload
} from "@web-admin-base/contracts";
import { runSqliteMigrations } from "@web-admin-base/db";
import { describe, expect, it } from "vitest";

import { createWorkerApplication } from "../src/bootstrap";
import { loadWorkerConfig } from "../src/config/load-config";
import { createWorkerDatabaseExecutor } from "../src/infra/worker-database-executor";
import {
  importExportProcessJobType,
  importExportProcessTaskCode
} from "../src/tasks/import-export-task";
import { fileCleanupTaskCode, importExportResultCleanupTaskCode } from "../src/tasks/file-cleanup-task";
import { logRetentionTaskCode } from "../src/tasks/log-retention-task";
import { scheduledRunJobType } from "../src/tasks/scheduled-run-task";

describe("worker bootstrap", () => {
  it("loads database and polling configuration from environment", () => {
    const config = loadWorkerConfig({
      NODE_ENV: "test",
      WORKER_NAME: "configured-worker",
      WORKER_POLL_INTERVAL_MS: "250",
      DATABASE_DIALECT: "sqlite",
      DATABASE_URL: "file:./data/test-worker.sqlite"
    });

    expect(config).toEqual({
      nodeEnv: "test",
      workerName: "configured-worker",
      pollIntervalMs: 250,
      database: {
        dialect: "sqlite",
        url: "file:./data/test-worker.sqlite"
      }
    });
  });

  it("processes durable in-app notification jobs into notification records", async () => {
    const filename = join(tmpdir(), `web-admin-worker-${process.pid}-${Date.now()}.sqlite`);
    const url = `file:${filename}`;
    runSqliteMigrations({ url });
    const executor = createWorkerDatabaseExecutor({ dialect: "sqlite", url });
    const application = createWorkerApplication(
      {
        nodeEnv: "test",
        workerName: "notification-worker",
        pollIntervalMs: 0,
        database: { dialect: "sqlite", url }
      },
      {
        executor,
        log: () => undefined
      }
    );
    const queue = createDatabaseQueueAdapter(executor, { workerId: "test-enqueuer" });

    try {
      await clearTables(executor);
      await application.runtime.start();
      await queue.enqueue<InAppNotificationDispatchPayload>(inAppNotificationDispatchJobType, {
        recipientUserIds: ["200", "201"],
        title: "System notice",
        body: "Maintenance starts at 22:00.",
        metadata: { source: "worker-test" },
        createdBy: "1",
        enqueuedAt: new Date().toISOString()
      });

      await expect(application.runtime.runOnce()).resolves.toEqual({ queueJobs: 1, scheduledJobs: 0 });

      const rows = await executor.all(
        "SELECT user_id, channel, title, body, status, metadata_json FROM notifications ORDER BY user_id ASC"
      );
      const queueRows = await executor.all("SELECT status FROM queue_jobs");

      expect(rows).toHaveLength(2);
      expect(rows.map((row) => String(row.user_id))).toEqual(["200", "201"]);
      expect(rows[0]).toEqual(
        expect.objectContaining({
          channel: "in_app",
          title: "System notice",
          body: "Maintenance starts at 22:00.",
          status: "unread"
        })
      );
      expect(readJson(rows[0]?.metadata_json)).toEqual({ source: "worker-test", createdBy: "1" });
      expect(queueRows).toEqual([expect.objectContaining({ status: "succeeded" })]);
    } finally {
      await clearTables(executor);
      await application.close();
      await executor.close();
      if (existsSync(filename)) rmSync(filename, { force: true });
    }
  });

  it("runs base task catalog jobs for log export, retention, and file cleanup", async () => {
    const filename = join(tmpdir(), `web-admin-worker-catalog-${process.pid}-${Date.now()}.sqlite`);
    const storageRoot = await mkdtemp(join(tmpdir(), "web-admin-worker-storage-"));
    const url = `file:${filename}`;
    runSqliteMigrations({ url });
    const executor = createWorkerDatabaseExecutor({ dialect: "sqlite", url });
    const storage = createLocalFileStorageAdapter({ rootDirectory: storageRoot });
    const application = createWorkerApplication(
      {
        nodeEnv: "test",
        workerName: "catalog-worker",
        pollIntervalMs: 0,
        database: { dialect: "sqlite", url }
      },
      {
        executor,
        storage,
        log: () => undefined
      }
    );
    const queue = createDatabaseQueueAdapter(executor, { workerId: "catalog-enqueuer" });

    try {
      await clearTables(executor);
      await application.runtime.start();
      await seedLogExport(executor);
      await queue.enqueue(importExportProcessJobType, {});

      await expect(application.runtime.runOnce()).resolves.toEqual({ queueJobs: 1, scheduledJobs: 0 });

      const exportRows = await executor.all(
        "SELECT status, result_file_object_id, total_rows, success_rows FROM import_export_tasks WHERE resource_type = 'logs:access'"
      );
      const resultFileId = String(exportRows[0]?.result_file_object_id);
      const fileRows = await executor.all("SELECT object_key, content_type FROM file_objects WHERE id = ?", [resultFileId]);
      const csv = await storage.get(String(fileRows[0]?.object_key));

      expect(exportRows.map((row) => ({ ...row, total_rows: Number(row.total_rows), success_rows: Number(row.success_rows) }))).toEqual([
        expect.objectContaining({ status: "succeeded", total_rows: 1, success_rows: 1 })
      ]);
      expect(fileRows).toEqual([expect.objectContaining({ content_type: "text/csv" })]);
      expect(new TextDecoder().decode(csv ?? new Uint8Array())).toContain("access exported");

      await seedOldLog(executor);
      await queue.enqueue(scheduledRunJobType, {
        scheduledTaskId: await scheduledTaskId(executor, logRetentionTaskCode)
      });
      await expect(application.runtime.runOnce()).resolves.toEqual({ queueJobs: 1, scheduledJobs: 0 });
      const oldLogs = await executor.all("SELECT id FROM log_entries WHERE message = 'old access log'");
      expect(oldLogs).toEqual([]);

      await seedInvalidFile(executor, storage);
      await queue.enqueue(scheduledRunJobType, {
        scheduledTaskId: await scheduledTaskId(executor, fileCleanupTaskCode)
      });
      await expect(application.runtime.runOnce()).resolves.toEqual({ queueJobs: 1, scheduledJobs: 0 });
      await expect(storage.get("uploads/invalid.txt")).resolves.toBeNull();

      const expiredResultFileId = await seedExpiredExportResult(executor, storage);
      await queue.enqueue(scheduledRunJobType, {
        scheduledTaskId: await scheduledTaskId(executor, importExportResultCleanupTaskCode)
      });
      await expect(application.runtime.runOnce()).resolves.toEqual({ queueJobs: 1, scheduledJobs: 0 });
      const expiredFileRows = await executor.all("SELECT status, is_deleted FROM file_objects WHERE id = ?", [
        expiredResultFileId
      ]);
      expect(expiredFileRows.map((row) => ({ ...row, is_deleted: Number(row.is_deleted) }))).toEqual([
        expect.objectContaining({ status: "invalid", is_deleted: 1 })
      ]);
      await expect(storage.get("exports/expired.csv")).resolves.toBeNull();

      const catalogTask = await scheduledTaskId(executor, importExportProcessTaskCode);
      expect(catalogTask).toMatch(/^\d+$/);
    } finally {
      await clearTables(executor);
      await application.close();
      await executor.close();
      if (existsSync(filename)) rmSync(filename, { force: true });
      await rm(storageRoot, { recursive: true, force: true });
    }
  });
});

async function clearTables(executor: DatabaseAdapterExecutor): Promise<void> {
  for (const table of [
    "file_references",
    "import_export_tasks",
    "file_objects",
    "notifications",
    "queue_jobs",
    "scheduled_jobs",
    "log_entries"
  ]) {
    await executor.run(`DELETE FROM ${table}`);
  }
}

async function seedLogExport(executor: DatabaseAdapterExecutor): Promise<void> {
  const now = new Date().toISOString();
  await executor.run(
    "INSERT INTO log_entries (log_type, level, message, metadata_json, occurred_at, created_at) VALUES ('access', 'info', 'access exported', ?, ?, ?)",
    [JSON.stringify({ path: "/api/health" }), now, now]
  );
  await executor.run(
    "INSERT INTO import_export_tasks (task_type, resource_type, status, error_preview_json, result_expires_at, created_at, updated_at, created_by) VALUES ('export', 'logs:access', 'pending', ?, ?, ?, ? , '1')",
    [JSON.stringify([]), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), now, now]
  );
}

async function seedOldLog(executor: DatabaseAdapterExecutor): Promise<void> {
  const old = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000).toISOString();
  await executor.run(
    "INSERT INTO log_entries (log_type, level, message, metadata_json, occurred_at, created_at) VALUES ('access', 'info', 'old access log', ?, ?, ?)",
    [JSON.stringify({}), old, old]
  );
}

async function seedInvalidFile(
  executor: DatabaseAdapterExecutor,
  storage: ReturnType<typeof createLocalFileStorageAdapter>
): Promise<void> {
  const now = new Date().toISOString();
  await storage.put("uploads/invalid.txt", new TextEncoder().encode("invalid"), "text/plain");
  await executor.run(
    "INSERT INTO file_objects (object_key, original_name, content_type, extension, size_bytes, storage_driver, status, referenced, is_deleted, deleted_at, created_at, updated_at) VALUES ('uploads/invalid.txt', 'invalid.txt', 'text/plain', 'txt', 7, 'local', 'invalid', 0, 1, ?, ?, ?)",
    [now, now, now]
  );
}

async function seedExpiredExportResult(
  executor: DatabaseAdapterExecutor,
  storage: ReturnType<typeof createLocalFileStorageAdapter>
): Promise<string> {
  const now = new Date().toISOString();
  const expired = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await storage.put("exports/expired.csv", new TextEncoder().encode("expired"), "text/csv");
  await executor.run(
    "INSERT INTO file_objects (object_key, original_name, content_type, extension, size_bytes, storage_driver, status, referenced, is_deleted, created_at, updated_at) VALUES ('exports/expired.csv', 'expired.csv', 'text/csv', 'csv', 7, 'local', 'active', 0, 0, ?, ?)",
    [now, now]
  );
  const fileRows = await executor.all("SELECT id FROM file_objects WHERE object_key = 'exports/expired.csv'");
  const fileId = String(fileRows[0]?.id);
  await executor.run(
    "INSERT INTO import_export_tasks (task_type, resource_type, status, result_file_object_id, error_preview_json, result_expires_at, created_at, updated_at, created_by) VALUES ('export', 'logs:access', 'succeeded', ?, ?, ?, ?, ?, '1')",
    [fileId, JSON.stringify([]), expired, now, now]
  );
  return fileId;
}

async function scheduledTaskId(executor: DatabaseAdapterExecutor, code: string): Promise<string> {
  const rows = await executor.all("SELECT id FROM scheduled_jobs WHERE code = ? LIMIT 1", [code]);
  if (!rows[0]) throw new Error(`Scheduled task was not registered: ${code}`);
  return String(rows[0].id);
}
