import type {
  CreateWebhookSubscriptionRequest,
  UpdateWebhookSubscriptionRequest,
} from "@web-admin-base/contracts";

import { requestJson, stringField, unwrapRecords } from "@/lib/api-request";

export type WebhookSubscription = {
  id: string;
  name: string;
  url: string;
  eventTypes: string[];
  secretConfigured: boolean;
  status: "enabled" | "disabled";
  createdAt: string;
  updatedAt: string;
};

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

function toWebhookSubscription(record: Record<string, unknown>): WebhookSubscription {
  return {
    id: stringField(record.id, ""),
    name: stringField(record.name, ""),
    url: stringField(record.url, ""),
    eventTypes: Array.isArray(record.eventTypes)
      ? record.eventTypes.filter((value): value is string => typeof value === "string")
      : [],
    secretConfigured: record.secretConfigured === true,
    status: record.status === "disabled" ? "disabled" : "enabled",
    createdAt: stringField(record.createdAt, ""),
    updatedAt: stringField(record.updatedAt, ""),
  };
}
