import {
  baseWebhookEventTypes,
  businessModuleWebhookOutboxEventSchema,
  webhookOutboxEventSchema,
  type BusinessModuleWebhookOutboxEvent,
  type WebhookOutboxEvent,
} from "@web-admin-base/contracts";

export type DeliverableWebhookEvent = WebhookOutboxEvent | BusinessModuleWebhookOutboxEvent;

export function parseOutboxEvent(
  type: string,
  raw: Record<string, unknown>,
  occurredAt: string,
): DeliverableWebhookEvent {
  if ((baseWebhookEventTypes as readonly string[]).includes(type)) {
    return webhookOutboxEventSchema.parse({
      ...raw,
      type,
      occurredAt: raw.occurredAt ?? occurredAt,
    });
  }
  const context = readRecord(raw.context);
  const moduleCode = String(context.moduleCode ?? "unknown-module");
  const messageId = String(raw.messageId ?? "unknown-message");
  return businessModuleWebhookOutboxEventSchema.parse({
    type,
    subject: `modules/${moduleCode}/messages/${messageId}`,
    occurredAt: raw.createdAt ?? occurredAt,
    data: raw,
  });
}

export function parsePersistedEvent(value: unknown): DeliverableWebhookEvent {
  const base = webhookOutboxEventSchema.safeParse(value);
  return base.success ? base.data : businessModuleWebhookOutboxEventSchema.parse(value);
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
