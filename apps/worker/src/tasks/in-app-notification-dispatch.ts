import {
  inAppNotificationDispatchJobType,
  inAppNotificationDispatchPayloadSchema,
  type InAppNotificationDispatchPayload,
} from "@web-admin-base/contracts";

import type { QueueWorkerTask } from "../runners/worker-runtime";

export type InAppNotificationDispatchHandler = (
  payload: InAppNotificationDispatchPayload,
) => Promise<void>;

export function createInAppNotificationDispatchTask(
  dispatch: InAppNotificationDispatchHandler,
): QueueWorkerTask {
  return {
    jobType: inAppNotificationDispatchJobType,
    async handler(job) {
      await dispatch(inAppNotificationDispatchPayloadSchema.parse(job.payload));
    },
  };
}
