import type {
  CreateWebhookSubscriptionRequest,
  UpdateWebhookSubscriptionRequest,
  WebhookEventType,
} from "@web-admin-base/contracts";

import { requestJson, stringField, unwrapRecords } from "@/lib/api-request";

export type WebhookSubscription = {
  id: string;
  name: string;
  url: string;
  eventTypes: WebhookEventType[];
  secretConfigured: boolean;
  status: "enabled" | "disabled";
  createdAt: string;
  updatedAt: string;
  revision: number;
};

export type WebhookEventTypeOption = { type: WebhookEventType; description: string };

export async function fetchWebhookSubscriptions(): Promise<WebhookSubscription[]> {
  const envelope = await requestJson<{ data?: unknown }>("/webhooks");
  return unwrapRecords(envelope.data).map(toWebhookSubscription);
}

export async function createWebhookSubscription(input: CreateWebhookSubscriptionRequest) {
  return requestJson<{ data: WebhookSubscription }>("/webhooks", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateWebhookSubscription(
  id: string,
  input: UpdateWebhookSubscriptionRequest,
) {
  return requestJson<{ data: WebhookSubscription }>(`/webhooks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteWebhookSubscription(id: string) {
  return requestJson<{ data: WebhookSubscription }>(`/webhooks/${id}`, { method: "DELETE" });
}

export async function fetchWebhookEventTypes(): Promise<WebhookEventTypeOption[]> {
  const envelope = await requestJson<{ data?: unknown }>("/webhook-event-types");
  return unwrapRecords(envelope.data).flatMap((record) => {
    const type = stringField(record.type, "");
    if (
      !["user.created", "job.failed", "permission.changed", "notification.requested"].includes(type)
    )
      return [];
    return [{ type: type as WebhookEventType, description: stringField(record.description, "") }];
  });
}

function toWebhookSubscription(record: Record<string, unknown>): WebhookSubscription {
  return {
    id: stringField(record.id, ""),
    name: stringField(record.name, ""),
    url: stringField(record.url, ""),
    eventTypes: Array.isArray(record.eventTypes)
      ? record.eventTypes.filter(
          (value): value is WebhookEventType =>
            typeof value === "string" &&
            ["user.created", "job.failed", "permission.changed", "notification.requested"].includes(
              value,
            ),
        )
      : [],
    secretConfigured: record.secretConfigured === true,
    status: record.status === "disabled" ? "disabled" : "enabled",
    createdAt: stringField(record.createdAt, ""),
    updatedAt: stringField(record.updatedAt, ""),
    revision: typeof record.revision === "number" ? record.revision : Number(record.revision ?? 1),
  };
}
