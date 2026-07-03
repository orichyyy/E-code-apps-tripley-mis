import { z } from "zod";

const strictObject = <T extends z.ZodRawShape>(shape: T) => z.object(shape).strict();

export const announcementScopeTypeSchema = z.enum(["system", "organization"]);
export const webhookSubscriptionStatusSchema = z.enum(["enabled", "disabled"]);

export const createAnnouncementRequestSchema = strictObject({
  title: z.string().min(1),
  content: z.string().min(1),
  scopeType: announcementScopeTypeSchema.default("system")
});

export const updateAnnouncementRequestSchema = strictObject({
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  scopeType: announcementScopeTypeSchema.optional()
});

export const createWebhookSubscriptionRequestSchema = strictObject({
  name: z.string().min(1),
  url: z.string().url(),
  eventTypes: z.array(z.string().min(1)).default([]),
  secret: z.string().nullable().optional(),
  status: webhookSubscriptionStatusSchema.default("enabled")
});

export const updateWebhookSubscriptionRequestSchema = strictObject({
  name: z.string().min(1).optional(),
  url: z.string().url().optional(),
  eventTypes: z.array(z.string().min(1)).optional(),
  secret: z.string().nullable().optional(),
  status: webhookSubscriptionStatusSchema.optional()
});

export type CreateAnnouncementRequest = z.infer<typeof createAnnouncementRequestSchema>;
export type UpdateAnnouncementRequest = z.infer<typeof updateAnnouncementRequestSchema>;
export type CreateWebhookSubscriptionRequest = z.infer<typeof createWebhookSubscriptionRequestSchema>;
export type UpdateWebhookSubscriptionRequest = z.infer<typeof updateWebhookSubscriptionRequestSchema>;
