import {
  createDatabaseJobSchedulerAdapter,
  createDatabaseLockAdapter,
  createAlertIntegrationPlaceholder,
  createDatabaseQueueAdapter,
  createConfiguredFileStorageAdapter,
  type DatabaseQueueAdapter,
  createRabbitMqQueueAdapter,
  createInMemoryNotificationChannelAdapter,
  createSmtpNotificationChannelAdapter,
  type DatabaseAdapterExecutor,
  type FileStorageAdapter,
  type AlertIntegration,
  type QueueAdapter,
} from "@web-admin-base/adapters";
import {
  businessModuleDefinitions,
  createWebhookEventCatalog,
  type BusinessModuleDefinition,
  type BusinessWorkerModuleRegistration,
} from "@web-admin-base/contracts";

import type { WorkerConfig } from "./config/load-config";
import { createWorkerDatabaseExecutor } from "./infra/worker-database-executor";
import { createWorkerRuntime, type WorkerRuntime } from "./runners/worker-runtime";
import { createEmailDeliveryProcessor } from "./email/email-delivery.processor";
import { WorkerEmailDeliveryRepository } from "./email/email-delivery.repository";
import { createInAppNotificationDispatchTask } from "./tasks/in-app-notification-dispatch";
import { createDatabaseInAppNotificationDispatchHandler } from "./tasks/in-app-notification-writer";
import { createBaseWorkerTaskCatalog } from "./tasks/task-catalog";
import { createWebhookDeliveryProcessor } from "./webhooks/webhook-delivery.processor";
import { WebhookDeliveryRepository } from "./webhooks/webhook-delivery.repository";
import { businessWorkerModuleRegistry } from "./business-modules/registry";
import { loadActiveBusinessWorkerRegistrations } from "./business-modules/active-registrations";
import { createBusinessModuleCsvTask } from "./business-modules/csv.task";
import { createBusinessModuleOperationLogTask } from "./business-modules/operation-log.task";
import {
  createBusinessModuleJobTasks,
  createBusinessModuleScheduledHandlers,
} from "./business-modules/worker-tasks";

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
  alert?: AlertIntegration;
  businessModules?: {
    definitions: readonly BusinessModuleDefinition[];
    registrations: readonly BusinessWorkerModuleRegistration[];
  };
};

export function createWorkerApplication(
  config: WorkerConfig,
  options: WorkerApplicationOptions = {},
): WorkerApplication {
  const executor = options.executor ?? createWorkerDatabaseExecutor(config.database);
  const ownsExecutor = !options.executor;
  const queue = createDatabaseQueueAdapter(executor, {
    workerId: config.workerName,
    emitJobFailureEvents: config.webhook.enabled,
  });
  return createWorkerApplicationWithQueue(config, executor, ownsExecutor, queue, queue, options);
}

export async function createConfiguredWorkerApplication(
  config: WorkerConfig,
  options: WorkerApplicationOptions = {},
): Promise<WorkerApplication> {
  const executor = options.executor ?? createWorkerDatabaseExecutor(config.database);
  const ownsExecutor = !options.executor;
  const durableQueue = createDatabaseQueueAdapter(executor, {
    workerId: config.workerName,
    emitJobFailureEvents: config.webhook.enabled,
  });
  const storage = options.storage ?? (await createConfiguredFileStorageAdapter(config.storage));
  const storageHealth = await storage.healthCheck();
  if (!storageHealth.ok) {
    throw new Error(`File storage is unavailable: ${storageHealth.message ?? "unknown"}`);
  }
  const queue =
    config.adapters.queueDriver === "rabbitmq"
      ? await createRabbitMqQueueAdapter({
          url: requireRabbitMqUrl(config),
          queuePrefix: "web-admin-base.queue",
        })
      : durableQueue;
  const activeRegistrations = await loadActiveBusinessWorkerRegistrations(
    executor,
    businessWorkerModuleRegistry,
  );
  return createWorkerApplicationWithQueue(config, executor, ownsExecutor, queue, durableQueue, {
    ...options,
    storage,
    businessModules: {
      definitions: businessModuleDefinitions,
      registrations: activeRegistrations,
    },
  });
}

function createWorkerApplicationWithQueue(
  config: WorkerConfig,
  executor: DatabaseAdapterExecutor,
  ownsExecutor: boolean,
  queue: QueueAdapter,
  durableQueue: Pick<DatabaseQueueAdapter, "processReady">,
  options: WorkerApplicationOptions,
): WorkerApplication {
  const moduleRegistrations = options.businessModules?.registrations ?? [];
  const activeModuleCodes = new Set(moduleRegistrations.map(({ moduleCode }) => moduleCode));
  const moduleDefinitions = (options.businessModules?.definitions ?? []).filter(({ moduleCode }) =>
    activeModuleCodes.has(moduleCode),
  );
  const scheduler = createDatabaseJobSchedulerAdapter(executor, {
    emitJobFailureEvents: config.webhook.enabled,
  });
  const webhookDelivery = createWebhookDeliveryProcessor({
    repository: new WebhookDeliveryRepository(
      executor,
      createWebhookEventCatalog(moduleDefinitions).map(({ type }) => type),
    ),
    config: config.webhook,
    workerId: config.workerName,
    log: (entry) =>
      (options.log ?? console.log)(JSON.stringify({ type: "webhook.delivery", ...entry })),
    alert: options.alert ?? createAlertIntegrationPlaceholder(),
  });
  const emailChannel =
    config.smtp.enabled && config.smtp.host && config.smtp.from
      ? createSmtpNotificationChannelAdapter({
          host: config.smtp.host,
          port: config.smtp.port,
          secure: config.smtp.secure,
          allowInsecureLocalhost: config.smtp.allowInsecureLocalhost,
          username: config.smtp.username,
          password: config.smtp.password,
          from: config.smtp.from,
          timeoutMs: config.smtp.timeoutMs,
        })
      : createInMemoryNotificationChannelAdapter();
  const emailDelivery = createEmailDeliveryProcessor({
    repository: new WorkerEmailDeliveryRepository(executor),
    config: config.emailDelivery,
    smtp: config.smtp,
    channel: emailChannel,
    workerId: config.workerName,
    log: (entry) => (options.log ?? console.log)(JSON.stringify(entry)),
    alert: options.alert ?? createAlertIntegrationPlaceholder(),
  });
  const catalog = createBaseWorkerTaskCatalog(executor, {
    storage: options.storage,
    webhookConfig: config.webhook,
    emailDeliveryConfig: config.emailDelivery,
    businessModuleHandlers: createBusinessModuleScheduledHandlers(
      options.businessModules?.definitions ?? [],
      options.businessModules?.registrations ?? [],
      createDatabaseLockAdapter(executor, { owner: `${config.workerName}:business-modules` }),
    ),
  });
  const runtime = createWorkerRuntime(config, {
    queue,
    durableQueue,
    scheduler,
    durableScheduler: scheduler,
    durableWebhook: webhookDelivery,
    durableEmail: emailDelivery,
    pollIntervalMs: config.pollIntervalMs,
    log: options.log,
    queueTasks: [
      createInAppNotificationDispatchTask(createDatabaseInAppNotificationDispatchHandler(executor)),
      createBusinessModuleOperationLogTask(executor),
      createBusinessModuleCsvTask(
        executor,
        catalog.storage,
        moduleDefinitions,
        moduleRegistrations,
      ),
      ...createBusinessModuleJobTasks(
        moduleDefinitions,
        moduleRegistrations,
        createDatabaseLockAdapter(executor, { owner: `${config.workerName}:business-module-jobs` }),
      ),
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
