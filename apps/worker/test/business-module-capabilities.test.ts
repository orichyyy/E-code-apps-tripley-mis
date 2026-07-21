import { existsSync, rmSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createInMemoryLockAdapter, createLocalFileStorageAdapter } from "@web-admin-base/adapters";
import {
  inAppNotificationDispatchPayloadSchema,
  type ModuleAsyncMessage,
  type ModuleExecutionContext,
} from "@web-admin-base/contracts";
import { runSqliteMigrations } from "@web-admin-base/db";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createBusinessModuleCsvTask } from "../src/business-modules/csv.task";
import { loadActiveBusinessWorkerRegistrations } from "../src/business-modules/active-registrations";
import { createBusinessModuleOperationLogTask } from "../src/business-modules/operation-log.task";
import { createBusinessModuleJobTasks } from "../src/business-modules/worker-tasks";
import { createWorkerDatabaseExecutor } from "../src/infra/worker-database-executor";
import { createDatabaseInAppNotificationDispatchHandler } from "../src/tasks/in-app-notification-writer";
import {
  createWorkerCapabilityRegistration,
  workerCapabilityModule,
} from "./fixtures/business-module-capabilities";

const files: string[] = [];

afterEach(() => {
  for (const filename of files.splice(0)) {
    if (existsSync(filename)) rmSync(filename, { force: true });
  }
});

describe("Business Module Worker capabilities", () => {
  it("validates queue payloads and reconstructs Worker execution context", async () => {
    const onJob = vi.fn(async () => undefined);
    const registration = createWorkerCapabilityRegistration({ onJob });
    const [task] = createBusinessModuleJobTasks(
      [workerCapabilityModule],
      [registration],
      createInMemoryLockAdapter(),
    );
    const message = createMessage({ batchSize: 10 });

    await task!.handler({ id: "1", type: task!.jobType, payload: message });

    expect(onJob).toHaveBeenCalledWith(
      message,
      expect.objectContaining({ context: expect.objectContaining({ source: "worker" }) }),
    );
  });

  it("writes async Operation Events and explicit-field CSV exports", async () => {
    const filename = join(tmpdir(), `module-worker-${process.pid}-${Date.now()}.sqlite`);
    files.push(filename);
    runSqliteMigrations({ url: `file:${filename}` });
    const executor = createWorkerDatabaseExecutor({ dialect: "sqlite", url: filename });
    const root = await mkdtemp(join(tmpdir(), "module-worker-files-"));
    const storage = createLocalFileStorageAdapter({ rootDirectory: root });
    try {
      const message = createMessage({ filters: {} });
      await seedExportTask(executor, message);
      const csvTask = createBusinessModuleCsvTask(
        executor,
        storage,
        [workerCapabilityModule],
        [createWorkerCapabilityRegistration()],
      );
      const operationTask = createBusinessModuleOperationLogTask(executor);

      await operationTask.handler({
        id: "1",
        type: operationTask.jobType,
        payload: {
          context: message.context,
          event: {
            eventCode: "fixture-worker.updated",
            outcome: "succeeded",
            details: { name: "record" },
          },
        },
      });
      const csvJob = {
        id: "2",
        type: csvTask.jobType,
        payload: { taskId: "1", message },
      };
      await csvTask.handler(csvJob);
      await csvTask.handler(csvJob);

      const logs = await executor.all("SELECT trace_id, metadata_json FROM log_entries");
      const tasks = await executor.all(
        "SELECT status, result_file_object_id FROM import_export_tasks WHERE id = 1",
      );
      const file = await executor.all("SELECT object_key FROM file_objects WHERE id = ?", [
        tasks[0]!.result_file_object_id,
      ]);
      const resultFiles = await executor.all("SELECT id FROM file_objects WHERE extension = 'csv'");
      const csv = await readFile(join(root, String(file[0]!.object_key)), "utf8");
      expect(logs[0]!.trace_id).toBe("trace-123");
      expect(tasks[0]!.status).toBe("succeeded");
      expect(csv).toBe("name\n'=1+1");
      expect(csv).not.toContain("ignored");
      expect(resultFiles).toHaveLength(1);
    } finally {
      await executor.close();
      await rm(root, { recursive: true, force: true });
    }
  });

  it("loads Worker registrations only for active accepted modules", async () => {
    const filename = join(tmpdir(), `module-active-${process.pid}-${Date.now()}.sqlite`);
    files.push(filename);
    runSqliteMigrations({ url: `file:${filename}` });
    const executor = createWorkerDatabaseExecutor({ dialect: "sqlite", url: filename });
    const registration = createWorkerCapabilityRegistration();
    const timestamp = new Date().toISOString();
    try {
      await executor.run(
        `INSERT INTO business_module_registry_entries
          (module_code, definition_json, definition_hash, activation_hash, status,
           accepted_at, created_at, updated_at)
         VALUES (?, ?, 'definition-hash', 'activation-hash', 'disabled', ?, ?, ?)`,
        [
          workerCapabilityModule.moduleCode,
          JSON.stringify(workerCapabilityModule),
          timestamp,
          timestamp,
          timestamp,
        ],
      );
      await expect(
        loadActiveBusinessWorkerRegistrations(executor, [registration]),
      ).resolves.toEqual([]);

      await executor.run(
        "UPDATE business_module_registry_entries SET status = 'active' WHERE module_code = ?",
        [workerCapabilityModule.moduleCode],
      );
      await expect(
        loadActiveBusinessWorkerRegistrations(executor, [registration]),
      ).resolves.toEqual([registration]);
    } finally {
      await executor.close();
    }
  });

  it("deduplicates module in-app Notification Events by User and request key", async () => {
    const filename = join(tmpdir(), `module-notification-${process.pid}-${Date.now()}.sqlite`);
    files.push(filename);
    runSqliteMigrations({ url: `file:${filename}` });
    const executor = createWorkerDatabaseExecutor({ dialect: "sqlite", url: filename });
    const dispatch = createDatabaseInAppNotificationDispatchHandler(executor);
    const payload = inAppNotificationDispatchPayloadSchema.parse({
      recipientUserIds: ["7"],
      title: "Record changed",
      body: "Record 42 changed.",
      requestKey: "fixture-worker:record-notice:notice-1",
      metadata: { moduleCode: "fixture-worker" },
      createdBy: "1",
      enqueuedAt: new Date().toISOString(),
    });
    try {
      await dispatch(payload);
      await dispatch(payload);

      const rows = await executor.all(
        "SELECT user_id, request_key FROM notifications WHERE request_key = ?",
        [payload.requestKey],
      );
      expect(rows).toEqual([
        expect.objectContaining({ user_id: 7n, request_key: payload.requestKey }),
      ]);
    } finally {
      await executor.close();
    }
  });
});

function context(): ModuleExecutionContext {
  return {
    moduleCode: "fixture-worker",
    source: "api",
    actorId: null,
    organizationId: "3",
    sessionId: null,
    requestId: "request-123",
    traceId: "trace-123",
    correlationId: "correlation-123",
    locale: "en",
  };
}

function createMessage(payload: unknown): ModuleAsyncMessage {
  return {
    messageId: "message-1",
    idempotencyKey: "task-1",
    context: context(),
    payload,
    createdAt: new Date().toISOString(),
  };
}

async function seedExportTask(
  executor: ReturnType<typeof createWorkerDatabaseExecutor>,
  message: ModuleAsyncMessage,
): Promise<void> {
  const timestamp = new Date().toISOString();
  await executor.run(
    `INSERT INTO import_export_tasks
      (id, idempotency_key, task_type, resource_type, status, error_preview_json, request_json,
       execution_context_json, result_expires_at, created_at, updated_at)
     VALUES (1, 'task-1', 'export', 'fixture-worker:records', 'pending', ?, ?, ?, ?, ?, ?)`,
    [
      JSON.stringify([]),
      JSON.stringify({ exportFields: ["name"] }),
      JSON.stringify(message.context),
      new Date(Date.now() + 30 * 86_400_000).toISOString(),
      timestamp,
      timestamp,
    ],
  );
}
