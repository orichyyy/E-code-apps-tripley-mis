import {
  createWebhookSubscriptionRequestSchema,
  updateWebhookSubscriptionRequestSchema,
  type CreateWebhookSubscriptionRequest,
  type UpdateWebhookSubscriptionRequest
} from "@web-admin-base/contracts";
import { z } from "zod";

export type WebhookFormMode = "create" | "edit";

export type WebhookFormValues = {
  name: string;
  url: string;
  eventTypesText: string;
  secret: string;
  status: "enabled" | "disabled";
};

export const webhookFormSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  eventTypesText: z.string(),
  secret: z.string(),
  status: z.enum(["enabled", "disabled"])
});

export const defaultWebhookFormValues: WebhookFormValues = {
  name: "",
  url: "",
  eventTypesText: "",
  secret: "",
  status: "enabled"
};

export function toWebhookApiInput(
  value: WebhookFormValues,
  mode: WebhookFormMode
): CreateWebhookSubscriptionRequest | UpdateWebhookSubscriptionRequest {
  const base = {
    name: value.name,
    url: value.url,
    eventTypes: parseEventTypes(value.eventTypesText),
    status: value.status
  };
  const secret = value.secret.trim();
  const input = secret ? { ...base, secret } : base;
  return mode === "create"
    ? createWebhookSubscriptionRequestSchema.parse({ ...input, secret: secret || null })
    : updateWebhookSubscriptionRequestSchema.parse(input);
}

function parseEventTypes(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
