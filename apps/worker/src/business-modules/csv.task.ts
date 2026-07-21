import type {
  DatabaseAdapterExecutor,
  FileStorageAdapter,
  QueueJob,
} from "@web-admin-base/adapters";
import {
  businessModuleCsvProcessJobType,
  moduleAsyncMessageSchema,
  type BusinessModuleDefinition,
  type BusinessWorkerModuleRegistration,
  type ModuleAsyncMessage,
} from "@web-admin-base/contracts";
import { createWorkerExecutionContext, encodeBusinessCsv } from "@web-admin-base/module-sdk";

import type { QueueWorkerTask } from "../runners/worker-runtime";
import { json, now, p } from "../tasks/db-utils";
import { persistCsvResult, readManagedCsv } from "./csv-file-io";

type CsvJobPayload = { taskId: string; message: ModuleAsyncMessage };

export function createBusinessModuleCsvTask(
  executor: DatabaseAdapterExecutor,
  storage: FileStorageAdapter,
  definitions: readonly BusinessModuleDefinition[],
  registrations: readonly BusinessWorkerModuleRegistration[],
  previewLimit = readPreviewLimit(),
): QueueWorkerTask {
  const catalog = createCsvCatalog(definitions, registrations);
  return {
    jobType: businessModuleCsvProcessJobType,
    async handler(job: QueueJob<unknown>) {
      const payload = parsePayload(job.payload);
      const task = await loadTask(executor, payload.taskId);
      if (!task) return;
      const entry = catalog.get(task.resourceType);
      if (!entry || entry.moduleCode !== payload.message.context.moduleCode) {
        throw new Error(`No active Business Module CSV handler for ${task.resourceType}.`);
      }
      await markRunning(executor, task.id);
      try {
        if (task.taskType === "export") {
          await processExport(executor, storage, task, payload.message, entry);
        } else {
          await processImport(executor, storage, task, payload.message, entry, previewLimit);
        }
      } catch (error) {
        await markFailed(executor, task.id, error);
        throw error;
      }
    },
  };
}

type CsvCatalogEntry = {
  moduleCode: string;
  definition: BusinessModuleDefinition["contributions"]["importExportResources"][number];
  handler: BusinessWorkerModuleRegistration["importExportHandlers"][string];
};

function createCsvCatalog(
  definitions: readonly BusinessModuleDefinition[],
  registrations: readonly BusinessWorkerModuleRegistration[],
): Map<string, CsvCatalogEntry> {
  const result = new Map<string, CsvCatalogEntry>();
  for (const registration of registrations) {
    const module = definitions.find(({ moduleCode }) => moduleCode === registration.moduleCode);
    if (!module) continue;
    for (const [resourceType, handler] of Object.entries(registration.importExportHandlers)) {
      const definition = module.contributions.importExportResources.find(
        (item) => item.resourceType === resourceType,
      );
      if (definition)
        result.set(resourceType, { moduleCode: module.moduleCode, definition, handler });
    }
  }
  return result;
}

async function processExport(
  executor: DatabaseAdapterExecutor,
  storage: FileStorageAdapter,
  task: CsvTaskRecord,
  message: ModuleAsyncMessage,
  entry: CsvCatalogEntry,
): Promise<void> {
  if (!entry.handler.export) throw new Error(`Export handler is missing for ${task.resourceType}.`);
  const result = await entry.handler.export(message, workerContext(message));
  const csv = encodeBusinessCsv(result.rows, task.exportFields);
  const fileId = await persistCsvResult(executor, storage, {
    taskId: task.id,
    moduleCode: entry.moduleCode,
    csv,
    suffix: "export",
    createdBy: task.createdBy,
  });
  await completeTask(
    executor,
    task.id,
    result.rows.length,
    result.rows.length,
    0,
    fileId,
    null,
    [],
  );
}

async function processImport(
  executor: DatabaseAdapterExecutor,
  storage: FileStorageAdapter,
  task: CsvTaskRecord,
  message: ModuleAsyncMessage,
  entry: CsvCatalogEntry,
  previewLimit: number,
): Promise<void> {
  if (!entry.handler.import || !task.fileId) {
    throw new Error(`Import handler or source file is missing for ${task.resourceType}.`);
  }
  const rows = await readManagedCsv(executor, storage, task.fileId);
  assertCsvColumns(rows, entry.definition.columns);
  const result = await entry.handler.import(message, rows, workerContext(message));
  const errorFileId =
    result.errors.length > 0
      ? await persistCsvResult(executor, storage, {
          taskId: task.id,
          moduleCode: entry.moduleCode,
          csv: encodeBusinessCsv(result.errors, ["row", "field", "message"]),
          suffix: "errors",
          createdBy: task.createdBy,
        })
      : null;
  await completeTask(
    executor,
    task.id,
    result.totalRows,
    result.successRows,
    result.errors.length,
    null,
    errorFileId,
    result.errors.slice(0, previewLimit),
  );
}

type CsvTaskRecord = {
  id: string;
  taskType: "import" | "export";
  resourceType: string;
  fileId: string | null;
  exportFields: string[];
  createdBy: string | null;
};

async function loadTask(
  executor: DatabaseAdapterExecutor,
  taskId: string,
): Promise<CsvTaskRecord | null> {
  const rows = await executor.all(
    `SELECT id, task_type, resource_type, file_object_id, request_json, created_by
     FROM import_export_tasks WHERE id = ${p(executor, 1)} AND status = 'pending' LIMIT 1`,
    [taskId],
  );
  if (!rows[0]) return null;
  const request = readObject(rows[0].request_json);
  return {
    id: String(rows[0].id),
    taskType: String(rows[0].task_type) as CsvTaskRecord["taskType"],
    resourceType: String(rows[0].resource_type),
    fileId: rows[0].file_object_id ? String(rows[0].file_object_id) : null,
    exportFields: Array.isArray(request.exportFields)
      ? request.exportFields.filter((item): item is string => typeof item === "string")
      : [],
    createdBy: rows[0].created_by ? String(rows[0].created_by) : null,
  };
}

function parsePayload(value: unknown): CsvJobPayload {
  if (!value || typeof value !== "object") throw new Error("CSV job payload is invalid.");
  const record = value as Record<string, unknown>;
  if (typeof record.taskId !== "string") throw new Error("CSV task ID is required.");
  return {
    taskId: record.taskId,
    message: moduleAsyncMessageSchema.parse(record.message) as ModuleAsyncMessage,
  };
}

function workerContext(message: ModuleAsyncMessage) {
  return {
    context: createWorkerExecutionContext(message.context),
    signal: new AbortController().signal,
  };
}

function assertCsvColumns(
  rows: Array<Record<string, string>>,
  columns: Array<{ code: string; required?: boolean }>,
): void {
  const allowed = new Set(columns.map(({ code }) => code));
  for (const [index, row] of rows.entries()) {
    if (Object.keys(row).some((field) => !allowed.has(field))) {
      throw new Error(`CSV row ${index + 2} contains undeclared columns.`);
    }
    for (const column of columns) {
      if (column.required && !row[column.code]?.trim()) {
        throw new Error(`CSV row ${index + 2} is missing required field ${column.code}.`);
      }
    }
  }
}

async function markRunning(executor: DatabaseAdapterExecutor, taskId: string): Promise<void> {
  await executor.run(
    `UPDATE import_export_tasks SET status = 'running', updated_at = ${p(executor, 1)} WHERE id = ${p(executor, 2)}`,
    [now(), taskId],
  );
}

async function completeTask(
  executor: DatabaseAdapterExecutor,
  taskId: string,
  total: number,
  succeeded: number,
  failed: number,
  resultFileId: string | null,
  errorFileId: string | null,
  preview: unknown[],
): Promise<void> {
  await executor.run(
    `UPDATE import_export_tasks SET status = ${p(executor, 1)}, total_rows = ${p(executor, 2)},
     success_rows = ${p(executor, 3)}, failed_rows = ${p(executor, 4)},
     result_file_object_id = ${p(executor, 5)}, error_file_object_id = ${p(executor, 6)},
     error_preview_json = ${p(executor, 7)}, updated_at = ${p(executor, 8)} WHERE id = ${p(executor, 9)}`,
    [
      failed > 0 ? "failed" : "succeeded",
      total,
      succeeded,
      failed,
      resultFileId,
      errorFileId,
      json(executor, preview),
      now(),
      taskId,
    ],
  );
}

async function markFailed(
  executor: DatabaseAdapterExecutor,
  taskId: string,
  error: unknown,
): Promise<void> {
  await executor.run(
    `UPDATE import_export_tasks SET status = 'failed', failed_rows = 1,
     error_preview_json = ${p(executor, 1)}, updated_at = ${p(executor, 2)} WHERE id = ${p(executor, 3)}`,
    [
      json(executor, [
        { row: null, message: error instanceof Error ? error.message : String(error) },
      ]),
      now(),
      taskId,
    ],
  );
}

function readObject(value: unknown): Record<string, unknown> {
  if (typeof value === "string") return JSON.parse(value) as Record<string, unknown>;
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function readPreviewLimit(): number {
  const value = Number(process.env.IMPORT_ERROR_PREVIEW_LIMIT ?? "20");
  return Number.isInteger(value) && value > 0 ? value : 20;
}
