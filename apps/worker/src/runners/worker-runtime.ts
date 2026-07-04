import type {
  DatabaseJobSchedulerAdapter,
  DatabaseQueueAdapter,
  JobSchedulerAdapter,
  QueueAdapter,
  QueueJob,
  ScheduledJobDefinition
} from "@web-admin-base/adapters";

import type { WorkerConfig } from "../config/load-config";

type WorkerRuntimeConfig = Pick<WorkerConfig, "nodeEnv" | "workerName">;

export type WorkerRuntime = {
  readonly name: string;
  start: () => Promise<void>;
  runOnce: () => Promise<{ queueJobs: number; scheduledJobs: number }>;
  stop: () => Promise<void>;
};

export type QueueWorkerTask = {
  jobType: string;
  handler: (job: QueueJob<unknown>) => Promise<void>;
};

export type ScheduledWorkerTask = {
  definition: ScheduledJobDefinition;
  handler: () => Promise<void>;
};

export type WorkerRuntimeDependencies = {
  queue?: QueueAdapter;
  durableQueue?: Pick<DatabaseQueueAdapter, "processReady">;
  scheduler?: JobSchedulerAdapter;
  durableScheduler?: Pick<DatabaseJobSchedulerAdapter, "processDue">;
  queueTasks?: QueueWorkerTask[];
  scheduledTasks?: ScheduledWorkerTask[];
  log?: (message: string) => void;
  pollIntervalMs?: number;
  unregisterScheduledTasksOnStop?: boolean;
};

export function createWorkerRuntime(
  config: WorkerRuntimeConfig,
  dependencies: WorkerRuntimeDependencies = {}
): WorkerRuntime {
  let started = false;
  let pollTimer: NodeJS.Timeout | null = null;
  const log = dependencies.log ?? console.log;
  const pollIntervalMs = dependencies.pollIntervalMs ?? 0;

  return {
    name: config.workerName,
    async start() {
      if (started) return;
      started = true;
      for (const task of dependencies.queueTasks ?? []) {
        if (!dependencies.queue) continue;
        await dependencies.queue.consume(task.jobType, task.handler);
      }
      for (const task of dependencies.scheduledTasks ?? []) {
        if (!dependencies.scheduler) continue;
        await dependencies.scheduler.register(task.definition, task.handler);
      }
      if (pollIntervalMs > 0 && (dependencies.durableQueue || dependencies.durableScheduler)) {
        pollTimer = setInterval(() => {
          void this.runOnce().catch((error: unknown) => {
            log(`${config.workerName} worker poll failed: ${error instanceof Error ? error.message : String(error)}`);
          });
        }, pollIntervalMs);
      }
      log(`${config.workerName} started`);
    },
    async runOnce() {
      const queueJobs = dependencies.durableQueue
        ? await dependencies.durableQueue.processReady()
        : 0;
      const scheduledJobs = dependencies.durableScheduler
        ? await dependencies.durableScheduler.processDue()
        : 0;
      return { queueJobs, scheduledJobs };
    },
    async stop() {
      if (!started) return;
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      if (dependencies.unregisterScheduledTasksOnStop) {
        for (const task of dependencies.scheduledTasks ?? []) {
          if (!dependencies.scheduler) continue;
          await dependencies.scheduler.unregister(task.definition.code);
        }
      }
      started = false;
      log(`${config.workerName} stopped`);
    }
  };
}
