import {
  createLocalFileStorageAdapter,
  createDatabaseLockAdapter,
  type DatabaseAdapterExecutor,
  type FileStorageAdapter,
  type WebhookDeliveryConfig,
  type EmailDeliveryConfig,
} from "@web-admin-base/adapters";

import type { QueueWorkerTask, ScheduledWorkerTask } from "../runners/worker-runtime";
import {
  createFileCleanupTaskHandler,
  createImportExportResultCleanupTaskHandler,
  fileCleanupTaskCode,
  importExportResultCleanupTaskCode,
} from "./file-cleanup-task";
import {
  createImportExportQueueTask,
  createImportExportScheduledHandler,
  importExportProcessTaskCode,
} from "./import-export-task";
import { createLogRetentionTaskHandler, logRetentionTaskCode } from "./log-retention-task";
import {
  createScheduledRunQueueTask,
  type ScheduledTaskHandlerRegistry,
} from "./scheduled-run-task";
import {
  createWebhookDeliveryCleanupTaskHandler,
  webhookDeliveryCleanupTaskCode,
} from "./webhook-cleanup-task";
import {
  createEmailDeliveryCleanupTaskHandler,
  emailDeliveryCleanupTaskCode,
} from "./email-delivery-cleanup-task";

export type WorkerTaskCatalog = {
  queueTasks: QueueWorkerTask[];
  scheduledTasks: ScheduledWorkerTask[];
  storage: FileStorageAdapter;
};

export type WorkerTaskCatalogOptions = {
  storage?: FileStorageAdapter;
  fileStorageRoot?: string;
  webhookConfig?: WebhookDeliveryConfig;
  emailDeliveryConfig?: EmailDeliveryConfig;
};

export function createBaseWorkerTaskCatalog(
  executor: DatabaseAdapterExecutor,
  options: WorkerTaskCatalogOptions = {},
): WorkerTaskCatalog {
  const storage =
    options.storage ??
    createLocalFileStorageAdapter({
      rootDirectory:
        options.fileStorageRoot ?? process.env.FILE_STORAGE_ROOT ?? ".web-admin-storage",
    });
  const handlers = createHandlerRegistry(
    executor,
    storage,
    options.webhookConfig,
    options.emailDeliveryConfig,
  );

  return {
    storage,
    queueTasks: [
      createImportExportQueueTask(executor, storage),
      createScheduledRunQueueTask(executor, handlers),
    ],
    scheduledTasks: [
      scheduledTask(logRetentionTaskCode, "0 2 * * *", handlers),
      scheduledTask(fileCleanupTaskCode, "30 2 * * *", handlers),
      scheduledTask(importExportProcessTaskCode, "* * * * *", handlers),
      scheduledTask(importExportResultCleanupTaskCode, "0 3 * * *", handlers),
      scheduledTask(webhookDeliveryCleanupTaskCode, "30 3 * * *", handlers),
      scheduledTask(emailDeliveryCleanupTaskCode, "45 3 * * *", handlers),
    ],
  };
}

function createHandlerRegistry(
  executor: DatabaseAdapterExecutor,
  storage: FileStorageAdapter,
  webhookConfig?: WebhookDeliveryConfig,
  emailDeliveryConfig?: EmailDeliveryConfig,
): ScheduledTaskHandlerRegistry {
  const lock = createDatabaseLockAdapter(executor);
  return new Map([
    [logRetentionTaskCode, createLogRetentionTaskHandler(executor)],
    [fileCleanupTaskCode, createFileCleanupTaskHandler(executor, storage)],
    [importExportProcessTaskCode, createImportExportScheduledHandler(executor, storage)],
    [
      emailDeliveryCleanupTaskCode,
      createEmailDeliveryCleanupTaskHandler(
        executor,
        emailDeliveryConfig ?? {
          enabled: false,
          concurrency: 4,
          maxAttempts: 5,
          retentionDays: 90,
          staleSeconds: 900,
          contentKeys: new Map(),
          activeKeyId: null,
        },
        lock,
      ),
    ],
    [
      webhookDeliveryCleanupTaskCode,
      createWebhookDeliveryCleanupTaskHandler(
        executor,
        webhookConfig ?? {
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
        lock,
      ),
    ],
    [
      importExportResultCleanupTaskCode,
      createImportExportResultCleanupTaskHandler(executor, storage),
    ],
  ]);
}

function scheduledTask(
  code: string,
  cronExpression: string,
  handlers: ScheduledTaskHandlerRegistry,
): ScheduledWorkerTask {
  const handler = handlers.get(code);
  if (!handler) throw new Error(`Missing scheduled task handler for ${code}.`);
  return {
    definition: {
      code,
      cronExpression,
      enabled: true,
    },
    handler,
  };
}
