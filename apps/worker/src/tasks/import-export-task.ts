import { randomUUID } from "node:crypto";

import type {
  DatabaseAdapterExecutor,
  FileStorageAdapter,
  QueueJob
} from "@web-admin-base/adapters";

import { bool, json, now, p } from "./db-utils";
import { writeWorkerTaskLog } from "./task-log";

export const importExportProcessJobType = "import-export.process";
export const importExportProcessTaskCode = "base.import-export.process";
const resultRetentionDays = 30;
const supportedLogTypes = new Set([
  "login",
  "operation",
  "access",
  "api_call",
  "exception",
  "security",
  "scheduler",
  "file_operation"
]);

type ImportExportProcessPayload = {
  taskId?: string;
};

export function createImportExportQueueTask(
  executor: DatabaseAdapterExecutor,
  storage: FileStorageAdapter
) {
  return {
    jobType: importExportProcessJobType,
    handler: async (job: QueueJob<unknown>) => {
      await processImportExportTasks(executor, storage, job.payload as ImportExportProcessPayload);
    }
  };
}

export function createImportExportScheduledHandler(
  executor: DatabaseAdapterExecutor,
  storage: FileStorageAdapter
) {
  return async (): Promise<void> => {
    await processImportExportTasks(executor, storage, {});
  };
}

export async function processImportExportTasks(
  executor: DatabaseAdapterExecutor,
  storage: FileStorageAdapter,
  payload: ImportExportProcessPayload
): Promise<void> {
  const tasks = await claimPendingExportTasks(executor, payload.taskId);
  let succeeded = 0;
  let failed = 0;

  for (const task of tasks) {
    try {
      await processExportTask(executor, storage, task);
      succeeded += 1;
    } catch (error) {
      failed += 1;
      await failTask(executor, task.id, error instanceof Error ? error.message : String(error));
    }
  }

  await writeWorkerTaskLog(executor, {
    level: failed > 0 ? "warn" : "info",
    message: "Import/export task processing completed",
    taskCode: importExportProcessTaskCode,
    metadata: { claimed: tasks.length, succeeded, failed, taskId: payload.taskId ?? null, completedAt: now() }
  });
}

async function claimPendingExportTasks(
  executor: DatabaseAdapterExecutor,
  taskId?: string
): Promise<Array<{ id: string; resourceType: string; createdBy: string | null }>> {
  return executor.transaction(async () => {
    const rows = await executor.all(
      `SELECT id, resource_type, created_by
       FROM import_export_tasks
       WHERE task_type = 'export' AND status = 'pending'
       ${taskId ? `AND id = ${p(executor, 1)}` : ""}
       ORDER BY id ASC LIMIT 10`,
      taskId ? [taskId] : []
    );
    const claimedAt = now();
    for (const row of rows) {
      await executor.run(
        `UPDATE import_export_tasks SET status = 'running', updated_at = ${p(executor, 1)}
         WHERE id = ${p(executor, 2)} AND status = 'pending'`,
        [claimedAt, row.id]
      );
    }
    return rows.map((row) => ({
      id: String(row.id),
      resourceType: String(row.resource_type),
      createdBy: row.created_by === null || row.created_by === undefined ? null : String(row.created_by)
    }));
  });
}

async function processExportTask(
  executor: DatabaseAdapterExecutor,
  storage: FileStorageAdapter,
  task: { id: string; resourceType: string; createdBy: string | null }
): Promise<void> {
  const logType = parseLogExportResource(task.resourceType);
  if (!logType) throw new Error(`Unsupported export resource type: ${task.resourceType}`);

  const logs = await executor.all(
    `SELECT id, log_type, level, message, trace_id, user_id, ip_address, metadata_json, occurred_at, created_at
     FROM log_entries WHERE log_type = ${p(executor, 1)} ORDER BY occurred_at DESC, id DESC LIMIT 10000`,
    [logType]
  );
  const csv = toCsv(logs);
  const objectKey = createExportObjectKey(task.id, logType);
  const stored = await storage.put(objectKey, new TextEncoder().encode(csv), "text/csv");
  const resultFileId = await insertResultFile(executor, stored, task.createdBy);
  const completedAt = now();

  await executor.run(
    `UPDATE import_export_tasks
     SET status = 'succeeded',
         result_file_object_id = ${p(executor, 1)},
         total_rows = ${p(executor, 2)},
         success_rows = ${p(executor, 3)},
         failed_rows = 0,
         error_preview_json = ${p(executor, 4)},
         result_expires_at = ${p(executor, 5)},
         updated_at = ${p(executor, 6)}
     WHERE id = ${p(executor, 7)}`,
    [
      resultFileId,
      logs.length,
      logs.length,
      json(executor, []),
      new Date(Date.now() + resultRetentionDays * 24 * 60 * 60 * 1000).toISOString(),
      completedAt,
      task.id
    ]
  );
}

async function insertResultFile(
  executor: DatabaseAdapterExecutor,
  stored: { objectKey: string; contentType: string; sizeBytes: number },
  createdBy: string | null
): Promise<string> {
  const createdAt = now();
  await executor.run(
    `INSERT INTO file_objects (object_key, original_name, content_type, extension, size_bytes, storage_driver, status, referenced, is_deleted, created_at, updated_at, created_by, updated_by)
     VALUES (${p(executor, 1)}, ${p(executor, 2)}, ${p(executor, 3)}, 'csv', ${p(executor, 4)}, 'local', 'active', ${bool(executor, false)}, ${bool(executor, false)}, ${p(executor, 5)}, ${p(executor, 6)}, ${p(executor, 7)}, ${p(executor, 8)})`,
    [
      stored.objectKey,
      stored.objectKey.split("/").at(-1) ?? "export.csv",
      stored.contentType,
      stored.sizeBytes,
      createdAt,
      createdAt,
      createdBy,
      createdBy
    ]
  );
  const rows = await executor.all(`SELECT id FROM file_objects WHERE object_key = ${p(executor, 1)} LIMIT 1`, [
    stored.objectKey
  ]);
  if (!rows[0]) throw new Error("Export result file metadata was not created.");
  return String(rows[0].id);
}

async function failTask(executor: DatabaseAdapterExecutor, taskId: string, message: string): Promise<void> {
  const failedAt = now();
  await executor.run(
    `UPDATE import_export_tasks
     SET status = 'failed', failed_rows = 1, error_preview_json = ${p(executor, 1)}, updated_at = ${p(executor, 2)}
     WHERE id = ${p(executor, 3)}`,
    [json(executor, [{ row: null, message }]), failedAt, taskId]
  );
}

function parseLogExportResource(resourceType: string): string | null {
  if (!resourceType.startsWith("logs:")) return null;
  const logType = resourceType.slice("logs:".length);
  return supportedLogTypes.has(logType) ? logType : null;
}

function createExportObjectKey(taskId: string, logType: string, date = new Date()): string {
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `exports/${year}/${month}/logs-${logType}-${taskId}-${randomUUID()}.csv`;
}

function toCsv(rows: Array<Record<string, unknown>>): string {
  const headers = ["id", "log_type", "level", "message", "trace_id", "user_id", "ip_address", "metadata_json", "occurred_at", "created_at"];
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))
  ].join("\n");
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}
