import {
  createLocalFileStorageAdapter,
  type DatabaseAdapterExecutor,
  type FileStorageAdapter
} from "@web-admin-base/adapters";

import type { QueueWorkerTask, ScheduledWorkerTask } from "../runners/worker-runtime";
import {
  createFileCleanupTaskHandler,
  createImportExportResultCleanupTaskHandler,
  fileCleanupTaskCode,
  importExportResultCleanupTaskCode
} from "./file-cleanup-task";
import {
  createImportExportQueueTask,
  createImportExportScheduledHandler,
  importExportProcessTaskCode
} from "./import-export-task";
import {
  createLogRetentionTaskHandler,
  logRetentionTaskCode
} from "./log-retention-task";
import {
  createScheduledRunQueueTask,
  type ScheduledTaskHandlerRegistry
} from "./scheduled-run-task";

export type WorkerTaskCatalog = {
  queueTasks: QueueWorkerTask[];
  scheduledTasks: ScheduledWorkerTask[];
  storage: FileStorageAdapter;
};

export type WorkerTaskCatalogOptions = {
  storage?: FileStorageAdapter;
  fileStorageRoot?: string;
};

export function createBaseWorkerTaskCatalog(
  executor: DatabaseAdapterExecutor,
  options: WorkerTaskCatalogOptions = {}
): WorkerTaskCatalog {
  const storage = options.storage ?? createLocalFileStorageAdapter({
    rootDirectory: options.fileStorageRoot ?? process.env.FILE_STORAGE_ROOT ?? ".web-admin-storage"
  });
  const handlers = createHandlerRegistry(executor, storage);

  return {
    storage,
    queueTasks: [
      createImportExportQueueTask(executor, storage),
      createScheduledRunQueueTask(executor, handlers)
    ],
    scheduledTasks: [
      scheduledTask(logRetentionTaskCode, "0 2 * * *", handlers),
      scheduledTask(fileCleanupTaskCode, "30 2 * * *", handlers),
      scheduledTask(importExportProcessTaskCode, "* * * * *", handlers),
      scheduledTask(importExportResultCleanupTaskCode, "0 3 * * *", handlers)
    ]
  };
}

function createHandlerRegistry(
  executor: DatabaseAdapterExecutor,
  storage: FileStorageAdapter
): ScheduledTaskHandlerRegistry {
  return new Map([
    [logRetentionTaskCode, createLogRetentionTaskHandler(executor)],
    [fileCleanupTaskCode, createFileCleanupTaskHandler(executor, storage)],
    [importExportProcessTaskCode, createImportExportScheduledHandler(executor, storage)],
    [importExportResultCleanupTaskCode, createImportExportResultCleanupTaskHandler(executor, storage)]
  ]);
}

function scheduledTask(
  code: string,
  cronExpression: string,
  handlers: ScheduledTaskHandlerRegistry
): ScheduledWorkerTask {
  const handler = handlers.get(code);
  if (!handler) throw new Error(`Missing scheduled task handler for ${code}.`);
  return {
    definition: {
      code,
      cronExpression,
      enabled: true
    },
    handler
  };
}
