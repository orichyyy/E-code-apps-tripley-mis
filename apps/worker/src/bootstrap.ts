import {
  createDatabaseJobSchedulerAdapter,
  createDatabaseQueueAdapter,
  type DatabaseQueueAdapter,
  createRabbitMqQueueAdapter,
  type DatabaseAdapterExecutor,
  type FileStorageAdapter,
  type QueueAdapter,
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
  queue: QueueAdapter;
  close: () => Promise<void>;
};

export type WorkerApplicationOptions = {
  executor?: DatabaseAdapterExecutor;
  storage?: FileStorageAdapter;
  log?: (message: string) => void;
};

export function createWorkerApplication(
  config: WorkerConfig,
  options: WorkerApplicationOptions = {},
): WorkerApplication {
  const executor = options.executor ?? createWorkerDatabaseExecutor(config.database);
  const ownsExecutor = !options.executor;
  const queue = createDatabaseQueueAdapter(executor, { workerId: config.workerName });
  return createWorkerApplicationWithQueue(config, executor, ownsExecutor, queue, queue, options);
}

export async function createConfiguredWorkerApplication(
  config: WorkerConfig,
  options: WorkerApplicationOptions = {},
): Promise<WorkerApplication> {
  const executor = options.executor ?? createWorkerDatabaseExecutor(config.database);
  const ownsExecutor = !options.executor;
  const durableQueue = createDatabaseQueueAdapter(executor, { workerId: config.workerName });
  const queue =
    config.adapters.queueDriver === "rabbitmq"
      ? await createRabbitMqQueueAdapter({
          url: requireRabbitMqUrl(config),
          queuePrefix: "web-admin-base.queue",
        })
      : durableQueue;
  return createWorkerApplicationWithQueue(
    config,
    executor,
    ownsExecutor,
    queue,
    durableQueue,
    options,
  );
}

function createWorkerApplicationWithQueue(
  config: WorkerConfig,
  executor: DatabaseAdapterExecutor,
  ownsExecutor: boolean,
  queue: QueueAdapter,
  durableQueue: Pick<DatabaseQueueAdapter, "processReady">,
  options: WorkerApplicationOptions,
): WorkerApplication {
  const scheduler = createDatabaseJobSchedulerAdapter(executor);
  const catalog = createBaseWorkerTaskCatalog(executor, { storage: options.storage });
  const runtime = createWorkerRuntime(config, {
    queue,
    durableQueue,
    scheduler,
    durableScheduler: scheduler,
    pollIntervalMs: config.pollIntervalMs,
    log: options.log,
    queueTasks: [
      createInAppNotificationDispatchTask(createDatabaseInAppNotificationDispatchHandler(executor)),
      ...catalog.queueTasks,
    ],
    scheduledTasks: catalog.scheduledTasks,
  });

  return {
    runtime,
    executor,
    queue,
    async close() {
      await runtime.stop();
      await closeQueueIfNeeded(queue);
      if (ownsExecutor) await executor.close();
    },
  };
}

function requireRabbitMqUrl(config: WorkerConfig): string {
  if (!config.adapters.rabbitMqUrl) throw new Error("RABBITMQ_URL is required.");
  return config.adapters.rabbitMqUrl;
}

async function closeQueueIfNeeded(queue: QueueAdapter): Promise<void> {
  if ("close" in queue && typeof queue.close === "function") {
    await queue.close();
  }
}
