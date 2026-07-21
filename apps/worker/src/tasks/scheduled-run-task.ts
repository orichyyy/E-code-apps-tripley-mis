import type { DatabaseAdapterExecutor, QueueJob } from "@web-admin-base/adapters";

import { p } from "./db-utils";
import { writeWorkerTaskLog } from "./task-log";

export const scheduledRunJobType = "scheduled.run";

export type ScheduledTaskHandlerRegistry = Map<string, (payload?: unknown) => Promise<void>>;

type ScheduledRunPayload = {
  scheduledTaskId?: string;
  handlerType?: string;
};

export function createScheduledRunQueueTask(
  executor: DatabaseAdapterExecutor,
  handlers: ScheduledTaskHandlerRegistry,
) {
  return {
    jobType: scheduledRunJobType,
    handler: async (job: QueueJob<unknown>) => {
      const payload = job.payload as ScheduledRunPayload;
      const task = payload.scheduledTaskId
        ? await findScheduledTask(executor, payload.scheduledTaskId)
        : null;
      const handlerType = task?.handlerType ?? payload.handlerType;
      if (!handlerType) throw new Error("scheduled.run requires scheduledTaskId or handlerType.");
      const handler = handlers.get(handlerType);
      if (!handler) throw new Error(`No scheduled task handler registered for ${handlerType}.`);
      await handler(task?.payload);
      await writeWorkerTaskLog(executor, {
        level: "info",
        message: "Manual scheduled task run completed",
        taskCode: scheduledRunJobType,
        metadata: {
          scheduledTaskId: payload.scheduledTaskId ?? null,
          handlerType,
        },
      });
    },
  };
}

async function findScheduledTask(
  executor: DatabaseAdapterExecutor,
  id: string,
): Promise<{ id: string; handlerType: string; payload: unknown } | null> {
  const rows = await executor.all(
    `SELECT id, handler_type, payload_json FROM scheduled_jobs WHERE id = ${p(executor, 1)} LIMIT 1`,
    [id],
  );
  return rows[0]
    ? {
        id: String(rows[0].id),
        handlerType: String(rows[0].handler_type),
        payload: readPayload(rows[0].payload_json),
      }
    : null;
}

function readPayload(value: unknown): unknown {
  return typeof value === "string" ? JSON.parse(value) : value;
}
