import { z } from "zod";

import { webhookEventTypeSchema } from "../webhook-events";

const strictObject = <T extends z.ZodRawShape>(shape: T) => z.object(shape).strict();

export const announcementScopeTypeSchema = z.enum(["system", "organization"]);
export const webhookSubscriptionStatusSchema = z.enum(["enabled", "disabled"]);
export const webhookDeliveryStatusSchema = z.enum([
  "pending",
  "running",
  "succeeded",
  "failed",
  "canceled",
]);

export const createAnnouncementRequestSchema = strictObject({
  title: z.string().min(1),
  content: z.string().min(1),
  scopeType: announcementScopeTypeSchema.default("system"),
});

export const updateAnnouncementRequestSchema = strictObject({
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  scopeType: announcementScopeTypeSchema.optional(),
});

export const createWebhookSubscriptionRequestSchema = strictObject({
  name: z.string().min(1),
  url: z.string().url(),
  eventTypes: z.array(webhookEventTypeSchema).min(1),
  secret: z.string().nullable().optional(),
  status: webhookSubscriptionStatusSchema.default("enabled"),
});

export const updateWebhookSubscriptionRequestSchema = strictObject({
  name: z.string().min(1).optional(),
  url: z.string().url().optional(),
  eventTypes: z.array(webhookEventTypeSchema).min(1).optional(),
  secret: z.string().nullable().optional(),
  status: webhookSubscriptionStatusSchema.optional(),
});

export type CreateAnnouncementRequest = z.infer<typeof createAnnouncementRequestSchema>;
export type UpdateAnnouncementRequest = z.infer<typeof updateAnnouncementRequestSchema>;
export type CreateWebhookSubscriptionRequest = z.infer<
  typeof createWebhookSubscriptionRequestSchema
>;
export type UpdateWebhookSubscriptionRequest = z.infer<
  typeof updateWebhookSubscriptionRequestSchema
>;

export const listWebhookDeliveriesQuerySchema = strictObject({
  subscriptionId: z.string().min(1).optional(),
  eventType: webhookEventTypeSchema.optional(),
  status: webhookDeliveryStatusSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListWebhookDeliveriesQuery = z.infer<typeof listWebhookDeliveriesQuerySchema>;
