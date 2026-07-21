import { existsSync, rmSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  createDatabaseQueueAdapter,
  createLocalFileStorageAdapter,
  readJson,
} from "@web-admin-base/adapters";
import {
  inAppNotificationDispatchJobType,
  type InAppNotificationDispatchPayload,
} from "@web-admin-base/contracts";
import { runSqliteMigrations } from "@web-admin-base/db";
import { describe, expect, it } from "vitest";

import { createWorkerApplication } from "../src/bootstrap";
import { loadWorkerConfig } from "../src/config/load-config";
import { createWorkerDatabaseExecutor } from "../src/infra/worker-database-executor";
import {
  importExportProcessJobType,
  importExportProcessTaskCode,
} from "../src/tasks/import-export-task";
import {
  fileCleanupTaskCode,
  importExportResultCleanupTaskCode,
} from "../src/tasks/file-cleanup-task";
import { logRetentionTaskCode } from "../src/tasks/log-retention-task";
import { scheduledRunJobType } from "../src/tasks/scheduled-run-task";
import { disabledEmailRuntimeConfig } from "./worker-config-expectations";
import {
  clearWorkerTables,
  localLocation,
  scheduledTaskId,
  seedExpiredExportResult,
  seedInvalidFile,
  seedLogExport,
  seedOldLog,
} from "./worker-test-helpers";

describe("worker bootstrap", () => {
  it("loads database and polling configuration from environment", () => {
    const config = loadWorkerConfig({
      NODE_ENV: "test",
      WORKER_NAME: "configured-worker",
      WORKER_POLL_INTERVAL_MS: "250",
      DATABASE_DIALECT: "sqlite",
      DATABASE_URL: "file:./data/test-worker.sqlite",
    });

    expect(config).toEqual({
      nodeEnv: "test",
      workerName: "configured-worker",
      pollIntervalMs: 250,
      adapters: {
        queueDriver: "database",
        rabbitMqUrl: null,
      },
      storage: {
        activeDriver: "local",
        local: { rootDirectory: ".web-admin-storage" },
        presignedUrlTtlSeconds: 60,
        s3: null,
      },
      database: {
        dialect: "sqlite",
        url: "file:./data/test-worker.sqlite",
      },
      ...disabledEmailRuntimeConfig,
      webhook: {
        enabled: false,
        eventSource: "web-admin-base-system",
        requestTimeoutMs: 10_000,
        maxAttempts: 5,
        concurrency: 4,
        retentionDays: 90,
        allowedHosts: new Set(),
        allowInsecureLocalhost: false,
        secretKeys: new Map(),
        activeKeyId: null,
      },
    });
  });

  it("loads optional RabbitMQ queue configuration", () => {
    const config = loadWorkerConfig({
      NODE_ENV: "test",
      QUEUE_DRIVER: "rabbitmq",
      RABBITMQ_URL: "amqp://guest:guest@127.0.0.1:5672",
      DATABASE_DIALECT: "sqlite",
      DATABASE_URL: "file:./data/test-worker.sqlite",
    });

    expect(config.adapters).toEqual({
      queueDriver: "rabbitmq",
      rabbitMqUrl: "amqp://guest:guest@127.0.0.1:5672",
    });
  });

  it("loads the shared S3 file-storage configuration", () => {
    const config = loadWorkerConfig({
      NODE_ENV: "test",
      FILE_STORAGE_DRIVER: "s3",
      S3_ENDPOINT: "http://127.0.0.1:9000",
      S3_REGION: "us-east-1",
      S3_BUCKET: "admin-files",
      S3_FORCE_PATH_STYLE: "true",
      DATABASE_DIALECT: "sqlite",
      DATABASE_URL: "file:./data/test-worker.sqlite",
    });

    expect(config.storage).toEqual(
      expect.objectContaining({
        activeDriver: "s3",
        s3: expect.objectContaining({ bucket: "admin-files", forcePathStyle: true }),
      }),
    );
  });

  it("rejects RabbitMQ worker queue configuration without a URL", () => {
    expect(() =>
      loadWorkerConfig({
        NODE_ENV: "test",
        QUEUE_DRIVER: "rabbitmq",
        DATABASE_DIALECT: "sqlite",
        DATABASE_URL: "file:./data/test-worker.sqlite",
      }),
    ).toThrow(/RABBITMQ_URL/);
  });

  it("processes durable in-app notification jobs into notification records", async () => {
    const filename = join(tmpdir(), `web-admin-worker-${process.pid}-${Date.now()}.sqlite`);
    const url = `file:${filename}`;
    runSqliteMigrations({ url });
    const executor = createWorkerDatabaseExecutor({ dialect: "sqlite", url });
    const application = createWorkerApplication(
      loadWorkerConfig({
        NODE_ENV: "test",
        WORKER_NAME: "notification-worker",
        WORKER_POLL_INTERVAL_MS: "0",
        DATABASE_DIALECT: "sqlite",
        DATABASE_URL: url,
      }),
      {
        executor,
        log: () => undefined,
      },
    );
    const queue = createDatabaseQueueAdapter(executor, { workerId: "test-enqueuer" });

    try {
      await clearWorkerTables(executor);
      await application.runtime.start();
      await queue.enqueue<InAppNotificationDispatchPayload>(inAppNotificationDispatchJobType, {
        recipientUserIds: ["200", "201"],
        title: "System notice",
        body: "Maintenance starts at 22:00.",
        requestKey: null,
        metadata: { source: "worker-test" },
        createdBy: "1",
        enqueuedAt: new Date().toISOString(),
      });

      await expect(application.runtime.runOnce()).resolves.toEqual({
        queueJobs: 1,
        scheduledJobs: 0,
      });

      const rows = await executor.all(
        "SELECT user_id, channel, title, body, status, metadata_json FROM notifications ORDER BY user_id ASC",
      );
      const queueRows = await executor.all("SELECT status FROM queue_jobs");

      expect(rows).toHaveLength(2);
      expect(rows.map((row) => String(row.user_id))).toEqual(["200", "201"]);
      expect(rows[0]).toEqual(
        expect.objectContaining({
          channel: "in_app",
          title: "System notice",
          body: "Maintenance starts at 22:00.",
          status: "unread",
        }),
      );
      expect(readJson(rows[0]?.metadata_json)).toEqual({ source: "worker-test", createdBy: "1" });
      expect(queueRows).toEqual([expect.objectContaining({ status: "succeeded" })]);
    } finally {
      await clearWorkerTables(executor);
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
      loadWorkerConfig({
        NODE_ENV: "test",
        WORKER_NAME: "catalog-worker",
        WORKER_POLL_INTERVAL_MS: "0",
        DATABASE_DIALECT: "sqlite",
        DATABASE_URL: url,
      }),
      {
        executor,
        storage,
        log: () => undefined,
      },
    );
    const queue = createDatabaseQueueAdapter(executor, { workerId: "catalog-enqueuer" });

    try {
      await clearWorkerTables(executor);
      await application.runtime.start();
      await seedLogExport(executor);
      await queue.enqueue(importExportProcessJobType, {});

      await expect(application.runtime.runOnce()).resolves.toEqual({
        queueJobs: 1,
        scheduledJobs: 0,
      });

      const exportRows = await executor.all(
        "SELECT status, result_file_object_id, total_rows, success_rows FROM import_export_tasks WHERE resource_type = 'logs:access'",
      );
      const resultFileId = String(exportRows[0]?.result_file_object_id);
      const fileRows = await executor.all(
        "SELECT object_key, content_type FROM file_objects WHERE id = ?",
        [resultFileId],
      );
      const csv = await storage.get(localLocation(String(fileRows[0]?.object_key)));

      expect(
        exportRows.map((row) => ({
          ...row,
          total_rows: Number(row.total_rows),
          success_rows: Number(row.success_rows),
        })),
      ).toEqual([expect.objectContaining({ status: "succeeded", total_rows: 1, success_rows: 1 })]);
      expect(fileRows).toEqual([expect.objectContaining({ content_type: "text/csv" })]);
      expect(new TextDecoder().decode(csv ?? new Uint8Array())).toContain("access exported");

      await seedOldLog(executor);
      await queue.enqueue(scheduledRunJobType, {
        scheduledTaskId: await scheduledTaskId(executor, logRetentionTaskCode),
      });
      await expect(application.runtime.runOnce()).resolves.toEqual({
        queueJobs: 1,
        scheduledJobs: 0,
      });
      const oldLogs = await executor.all(
        "SELECT id FROM log_entries WHERE message = 'old access log'",
      );
      expect(oldLogs).toEqual([]);

      await seedInvalidFile(executor, storage);
      await queue.enqueue(scheduledRunJobType, {
        scheduledTaskId: await scheduledTaskId(executor, fileCleanupTaskCode),
      });
      await expect(application.runtime.runOnce()).resolves.toEqual({
        queueJobs: 1,
        scheduledJobs: 0,
      });
      await expect(storage.get(localLocation("uploads/invalid.txt"))).resolves.toBeNull();
      const cleanedFiles = await executor.all(
        "SELECT content_deleted_at FROM file_objects WHERE object_key = 'uploads/invalid.txt'",
      );
      expect(cleanedFiles[0]?.content_deleted_at).toBeTruthy();

      const expiredResultFileId = await seedExpiredExportResult(executor, storage);
      await queue.enqueue(scheduledRunJobType, {
        scheduledTaskId: await scheduledTaskId(executor, importExportResultCleanupTaskCode),
      });
      await expect(application.runtime.runOnce()).resolves.toEqual({
        queueJobs: 1,
        scheduledJobs: 0,
      });
      const expiredFileRows = await executor.all(
        "SELECT status, is_deleted, content_deleted_at FROM file_objects WHERE id = ?",
        [expiredResultFileId],
      );
      expect(
        expiredFileRows.map((row) => ({ ...row, is_deleted: Number(row.is_deleted) })),
      ).toEqual([
        expect.objectContaining({
          status: "invalid",
          is_deleted: 1,
          content_deleted_at: expect.any(String),
        }),
      ]);
      await expect(storage.get(localLocation("exports/expired.csv"))).resolves.toBeNull();

      const catalogTask = await scheduledTaskId(executor, importExportProcessTaskCode);
      expect(catalogTask).toMatch(/^\d+$/);
    } finally {
      await clearWorkerTables(executor);
      await application.close();
      await executor.close();
      if (existsSync(filename)) rmSync(filename, { force: true });
      await rm(storageRoot, { recursive: true, force: true });
    }
  });
});
