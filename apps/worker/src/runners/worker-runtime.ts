import type {
  JobSchedulerAdapter,
  QueueAdapter,
  QueueJob,
  ScheduledJobDefinition
} from "@web-admin-base/adapters";

import type { WorkerConfig } from "../config/load-config";

export type WorkerRuntime = {
  readonly name: string;
  start: () => Promise<void>;
  stop: () => Promise<void>;
};

export type QueueWorkerTask<TPayload = unknown> = {
  jobType: string;
  handler: (job: QueueJob<TPayload>) => Promise<void>;
};

export type ScheduledWorkerTask = {
  definition: ScheduledJobDefinition;
  handler: () => Promise<void>;
};

export type WorkerRuntimeDependencies = {
  queue?: QueueAdapter;
  scheduler?: JobSchedulerAdapter;
  queueTasks?: QueueWorkerTask[];
  scheduledTasks?: ScheduledWorkerTask[];
  log?: (message: string) => void;
};

export function createWorkerRuntime(
  config: WorkerConfig,
  dependencies: WorkerRuntimeDependencies = {}
): WorkerRuntime {
  let started = false;
  const log = dependencies.log ?? console.log;

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
      log(`${config.workerName} started`);
    },
    async stop() {
      if (!started) return;
      for (const task of dependencies.scheduledTasks ?? []) {
        if (!dependencies.scheduler) continue;
        await dependencies.scheduler.unregister(task.definition.code);
      }
      started = false;
      log(`${config.workerName} stopped`);
    }
  };
}
