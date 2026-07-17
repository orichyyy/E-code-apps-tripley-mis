import type { NotificationChannelAdapter, NotificationMessage } from ".";
import type { DatabaseAdapterExecutor } from "../database/executor";
import { jsonParam, nowIso } from "../database/executor";

export type DirectedWebhookNotificationEvent = {
  type: "notification.requested";
  targetSubscriptionId: string;
  subject: string;
  occurredAt: string;
  data: {
    notificationId: string;
    subject: string;
    body: string;
    locale: string;
    referenceType: string | null;
    referenceId: string | null;
  };
};

export type WebhookNotificationPublisher = {
  publish: (event: DirectedWebhookNotificationEvent) => Promise<void>;
};

export function createDatabaseWebhookNotificationPublisher(
  executor: DatabaseAdapterExecutor,
): WebhookNotificationPublisher {
  return {
    async publish(event) {
      const now = nowIso();
      await executor.run(
        `INSERT INTO event_outbox
         (event_type, payload_json, status, attempt, max_attempts, occurred_at, created_at, updated_at)
         VALUES ('notification.requested', ${p(executor, 1)}, 'pending', 0, 1,
          ${p(executor, 2)}, ${p(executor, 3)}, ${p(executor, 4)})`,
        [jsonParam(event, executor.dialect), event.occurredAt, now, now],
      );
    },
  };
}

export function createWebhookNotificationChannelAdapter(options: {
  enabled: boolean;
  publisher: WebhookNotificationPublisher;
  now?: () => string;
}): NotificationChannelAdapter {
  return {
    async healthCheck() {
      return { ok: true, message: options.enabled ? undefined : "Webhook delivery is disabled." };
    },
    async send(message) {
      if (message.channel !== "webhook")
        throw new Error("Webhook notification channel requires channel=webhook.");
      if (!options.enabled) return;
      await options.publisher.publish(
        toEvent(message, options.now?.() ?? new Date().toISOString()),
      );
    },
  };
}

function toEvent(
  message: NotificationMessage,
  occurredAt: string,
): DirectedWebhookNotificationEvent {
  const metadata = message.metadata ?? {};
  const notificationId = requiredString(metadata.notificationId, "notificationId");
  const locale = requiredString(metadata.locale, "locale");
  return {
    type: "notification.requested",
    targetSubscriptionId: message.recipient,
    subject: `notifications/${notificationId}`,
    occurredAt,
    data: {
      notificationId,
      subject: message.subject ?? "Notification",
      body: message.body,
      locale,
      referenceType: nullableString(metadata.referenceType),
      referenceId: nullableString(metadata.referenceId),
    },
  };
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Webhook notification metadata.${field} is required.`);
  }
  return value;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function p(executor: DatabaseAdapterExecutor, index: number): string {
  return executor.dialect === "postgresql" ? `$${index}` : "?";
}
