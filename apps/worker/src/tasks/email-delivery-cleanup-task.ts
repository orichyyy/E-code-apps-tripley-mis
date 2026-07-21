import type {
  DatabaseAdapterExecutor,
  EmailDeliveryConfig,
  LockAdapter,
} from "@web-admin-base/adapters";
import { baseScheduledJobTypes } from "@web-admin-base/contracts";

import { WorkerEmailDeliveryRepository } from "../email/email-delivery.repository";
import { withDistributedTaskLock } from "./distributed-task";

export const emailDeliveryCleanupTaskCode = baseScheduledJobTypes.emailDeliveryCleanup;

export function createEmailDeliveryCleanupTaskHandler(
  executor: DatabaseAdapterExecutor,
  config: EmailDeliveryConfig,
  lock: LockAdapter,
) {
  const repository = new WorkerEmailDeliveryRepository(executor);
  return withDistributedTaskLock(lock, emailDeliveryCleanupTaskCode, () =>
    repository.cleanup(config.retentionDays).then(() => undefined),
  );
}
