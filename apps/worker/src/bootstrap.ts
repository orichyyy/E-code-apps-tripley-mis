import {
  createDatabaseJobSchedulerAdapter,
  createDatabaseQueueAdapter,
  type DatabaseAdapterExecutor,
  type FileStorageAdapter
} from "@web-admin-base/adapters";

import type { WorkerConfig } from "./config/load-config";
import { createWorkerDatabaseExecutor } from "./infra/worker-database-executor";
import { createWorkerRuntime, type WorkerRuntime } from "./runners/worker-runtime";
import { createInAppNotificationDispatchTask } from "./tasks/in-app-notification-dispatch";
import { createDatabaseInAppNotificationDispatchHandler } from "./tasks/in-app-notification-writer";
import { createBaseWorkerTaskCatalog } from "./tasks/task-catalog";

export type WorkerApplication = {
  runtime: WorkerRuntime;
  executor: DatabaseAdapterExecutor;
  close: () => Promise<void>;
};

export type WorkerApplicationOptions = {
  executor?: DatabaseAdapterExecutor;
  storage?: FileStorageAdapter;
  log?: (message: string) => void;
};

export function createWorkerApplication(
  config: WorkerConfig,
  options: WorkerApplicationOptions = {}
): WorkerApplication {
  const executor = options.executor ?? createWorkerDatabaseExecutor(config.database);
  const ownsExecutor = !options.executor;
  const queue = createDatabaseQueueAdapter(executor, { workerId: config.workerName });
  const scheduler = createDatabaseJobSchedulerAdapter(executor);
  const catalog = createBaseWorkerTaskCatalog(executor, { storage: options.storage });
  const runtime = createWorkerRuntime(config, {
    queue,
    durableQueue: queue,
    scheduler,
    durableScheduler: scheduler,
    pollIntervalMs: config.pollIntervalMs,
    log: options.log,
    queueTasks: [
      createInAppNotificationDispatchTask(createDatabaseInAppNotificationDispatchHandler(executor)),
      ...catalog.queueTasks
    ],
    scheduledTasks: catalog.scheduledTasks
  });

  return {
    runtime,
    executor,
    async close() {
      await runtime.stop();
      if (ownsExecutor) await executor.close();
    }
  };
}
