import {
  createWebhookSubscriptionRequestSchema,
  updateWebhookSubscriptionRequestSchema,
  type CreateWebhookSubscriptionRequest,
  type UpdateWebhookSubscriptionRequest,
  type WebhookEventType,
} from "@web-admin-base/contracts";
import { z } from "zod";

export type WebhookFormMode = "create" | "edit";

export type WebhookFormValues = {
  name: string;
  url: string;
  eventTypes: WebhookEventType[];
  secret: string;
  status: "enabled" | "disabled";
};

export const webhookFormSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  eventTypes: z
    .array(z.enum(["user.created", "job.failed", "permission.changed", "notification.requested"]))
    .min(1),
  secret: z.string(),
  status: z.enum(["enabled", "disabled"]),
});

export const defaultWebhookFormValues: WebhookFormValues = {
  name: "",
  url: "",
  eventTypes: [],
  secret: "",
  status: "enabled",
};

export function toWebhookApiInput(
  value: WebhookFormValues,
  mode: WebhookFormMode,
): CreateWebhookSubscriptionRequest | UpdateWebhookSubscriptionRequest {
  const base = {
    name: value.name,
    url: value.url,
    eventTypes: value.eventTypes,
    status: value.status,
  };
  const secret = value.secret.trim();
  const input = secret ? { ...base, secret } : base;
  return mode === "create"
    ? createWebhookSubscriptionRequestSchema.parse({ ...input, secret: secret || null })
    : updateWebhookSubscriptionRequestSchema.parse(input);
}
