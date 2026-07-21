import type { LockAdapter, QueueJob } from "@web-admin-base/adapters";
import type {
  BusinessModuleDefinition,
  BusinessWorkerModuleRegistration,
  ModuleAsyncMessage,
} from "@web-admin-base/contracts";
import { createWorkerExecutionContext, parseModuleAsyncMessage } from "@web-admin-base/module-sdk";

import type { QueueWorkerTask } from "../runners/worker-runtime";
import type { ScheduledTaskHandlerRegistry } from "../tasks/scheduled-run-task";

export function createBusinessModuleJobTasks(
  definitions: readonly BusinessModuleDefinition[],
  registrations: readonly BusinessWorkerModuleRegistration[],
  lock?: LockAdapter,
): QueueWorkerTask[] {
  const definitionsByCode = new Map(definitions.map((item) => [item.moduleCode, item]));
  return registrations.flatMap((registration) => {
    const definition = definitionsByCode.get(registration.moduleCode);
    if (!definition) return [];
    return Object.entries(registration.jobHandlers).map(([jobType, handler]) => {
      const job = definition.contributions.scheduledJobs.find((item) => item.jobType === jobType);
      const schema = job && registration.schemas[job.parameterSchemaId];
      if (!job || !schema) throw new Error(`Invalid Business Module job registration: ${jobType}.`);
      return {
        jobType,
        handler: async (queueJob: QueueJob<unknown>) => {
          const message = parseModuleAsyncMessage(queueJob.payload, schema);
          assertMessageOwner(registration.moduleCode, message);
          await runWithExecutionBoundary(message, job, handler, lock);
        },
      } satisfies QueueWorkerTask;
    });
  });
}

export function createBusinessModuleScheduledHandlers(
  definitions: readonly BusinessModuleDefinition[],
  registrations: readonly BusinessWorkerModuleRegistration[],
  lock?: LockAdapter,
): ScheduledTaskHandlerRegistry {
  const handlers: ScheduledTaskHandlerRegistry = new Map();
  for (const registration of registrations) {
    const definition = definitions.find(({ moduleCode }) => moduleCode === registration.moduleCode);
    if (!definition) continue;
    for (const jobType of Object.keys(registration.jobHandlers)) {
      handlers.set(jobType, (value) =>
        runBusinessModuleScheduledJob({
          moduleCode: registration.moduleCode,
          jobType,
          value,
          definition,
          registration,
          lock,
        }),
      );
    }
  }
  return handlers;
}

export async function runBusinessModuleScheduledJob(input: {
  moduleCode: string;
  jobType: string;
  value: unknown;
  definition: BusinessModuleDefinition;
  registration: BusinessWorkerModuleRegistration;
  lock?: LockAdapter;
}): Promise<void> {
  const job = input.definition.contributions.scheduledJobs.find(
    (item) => item.jobType === input.jobType,
  );
  const schema = job && input.registration.schemas[job.parameterSchemaId];
  const handler = input.registration.jobHandlers[input.jobType];
  if (!job || !schema || !handler) throw new Error(`Invalid scheduled job ${input.jobType}.`);
  const message = parseModuleAsyncMessage(input.value, schema);
  assertMessageOwner(input.moduleCode, message);
  await runWithExecutionBoundary(message, job, handler, input.lock);
}

async function runWithExecutionBoundary(
  message: ModuleAsyncMessage,
  job: BusinessModuleDefinition["contributions"]["scheduledJobs"][number],
  handler: BusinessWorkerModuleRegistration["jobHandlers"][string],
  lock?: LockAdapter,
): Promise<void> {
  if (
    (message.execution?.timeoutSeconds ?? job.defaultTimeoutSeconds) > job.maxTimeoutSeconds ||
    (message.execution?.maxAttempts ?? job.defaultMaxAttempts) > job.maxAttempts
  ) {
    throw new Error(`Business Module job ${job.jobType} exceeds its declared execution bounds.`);
  }
  if (job.executionMode === "perServer") {
    await runWithTimeout(message, job.defaultTimeoutSeconds, handler);
    return;
  }
  if (!lock) throw new Error(`Singleton Business Module job ${job.jobType} requires LockAdapter.`);
  const timeoutSeconds = message.execution?.timeoutSeconds ?? job.defaultTimeoutSeconds;
  const handle = await lock.acquire(`business-module:${job.jobType}`, {
    ttlSeconds: timeoutSeconds,
  });
  if (!handle) return;
  try {
    await runWithTimeout(message, job.defaultTimeoutSeconds, handler);
  } finally {
    await handle.release();
  }
}

async function runWithTimeout(
  message: ModuleAsyncMessage,
  defaultTimeoutSeconds: number,
  handler: BusinessWorkerModuleRegistration["jobHandlers"][string],
): Promise<void> {
  const timeoutSeconds = message.execution?.timeoutSeconds ?? defaultTimeoutSeconds;
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`Business Module job timed out after ${timeoutSeconds} seconds.`));
    }, timeoutSeconds * 1000);
  });
  try {
    await Promise.race([
      handler(message, {
        context: createWorkerExecutionContext(message.context),
        signal: controller.signal,
      }),
      timeout,
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function assertMessageOwner(moduleCode: string, message: ModuleAsyncMessage): void {
  if (message.context.moduleCode !== moduleCode) {
    throw new Error(`Async message does not belong to Business Module ${moduleCode}.`);
  }
}
