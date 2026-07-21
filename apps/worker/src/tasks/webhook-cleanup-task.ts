import type {
  DatabaseAdapterExecutor,
  LockAdapter,
  WebhookDeliveryConfig,
} from "@web-admin-base/adapters";
import { baseScheduledJobTypes } from "@web-admin-base/contracts";

import { WebhookDeliveryRepository } from "../webhooks/webhook-delivery.repository";
import { withDistributedTaskLock } from "./distributed-task";

export const webhookDeliveryCleanupTaskCode = baseScheduledJobTypes.webhookDeliveryCleanup;

export function createWebhookDeliveryCleanupTaskHandler(
  executor: DatabaseAdapterExecutor,
  config: WebhookDeliveryConfig,
  lock: LockAdapter,
) {
  const repository = new WebhookDeliveryRepository(executor);
  return withDistributedTaskLock(lock, webhookDeliveryCleanupTaskCode, () =>
    repository.cleanup(config.retentionDays).then(() => undefined),
  );
}
