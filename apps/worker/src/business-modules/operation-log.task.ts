import type { DatabaseAdapterExecutor, QueueJob } from "@web-admin-base/adapters";
import {
  businessModuleOperationLogJobType,
  moduleOperationLogJobSchema,
} from "@web-admin-base/contracts";

import type { QueueWorkerTask } from "../runners/worker-runtime";
import { json, now, p } from "../tasks/db-utils";

export function createBusinessModuleOperationLogTask(
  executor: DatabaseAdapterExecutor,
): QueueWorkerTask {
  return {
    jobType: businessModuleOperationLogJobType,
    async handler(job: QueueJob<unknown>) {
      const { context, event } = moduleOperationLogJobSchema.parse(job.payload);
      const occurredAt = now();
      await executor.run(
        `INSERT INTO log_entries
          (log_type, level, message, trace_id, user_id, metadata_json, occurred_at, created_at)
         VALUES ('operation', ${p(executor, 1)}, ${p(executor, 2)}, ${p(executor, 3)},
          ${p(executor, 4)}, ${p(executor, 5)}, ${p(executor, 6)}, ${p(executor, 7)})`,
        [
          event.outcome === "succeeded" ? "info" : "error",
          event.eventCode,
          context.traceId,
          context.actorId,
          json(executor, {
            moduleCode: context.moduleCode,
            eventCode: event.eventCode,
            outcome: event.outcome,
            organizationId: context.organizationId,
            requestId: context.requestId,
            correlationId: context.correlationId,
            targetId: event.targetId ?? null,
            targetSummary: event.targetSummary ?? null,
            errorCode: event.errorCode ?? null,
            details: event.details,
          }),
          occurredAt,
          occurredAt,
        ],
      );
    },
  };
}
