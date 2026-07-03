import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  createDatabaseQueueAdapter,
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
});

async function clearTables(executor: DatabaseAdapterExecutor): Promise<void> {
  for (const table of ["notifications", "queue_jobs", "scheduled_jobs"]) {
    await executor.run(`DELETE FROM ${table}`);
  }
}
