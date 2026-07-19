import { z } from "zod";

import { webhookEventTypeSchema } from "../webhook-events";

const strictObject = <T extends z.ZodRawShape>(shape: T) => z.object(shape).strict();

export const announcementScopeTypeSchema = z.enum(["system", "organization"]);
export const announcementStatusSchema = z.enum(["draft", "published", "deleted"]);
export const webhookSubscriptionStatusSchema = z.enum(["enabled", "disabled"]);
export const webhookDeliveryStatusSchema = z.enum([
  "pending",
  "running",
  "succeeded",
  "failed",
  "canceled",
]);

const organizationIdSchema = z.string().regex(/^[1-9]\d*$/);
const targetOrganizationIdsSchema = z.array(organizationIdSchema).superRefine((ids, context) => {
  if (new Set(ids).size !== ids.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Duplicate targets are not allowed.",
    });
  }
});

export const createAnnouncementRequestSchema = strictObject({
  title: z.string().trim().min(1),
  content: z.string().trim().min(1),
  scopeType: announcementScopeTypeSchema.default("system"),
  targetOrganizationIds: targetOrganizationIdsSchema.optional().default([]),
  expiresAt: z.string().datetime().nullable().optional(),
}).superRefine(validateAnnouncementScope);

export const updateAnnouncementRequestSchema = strictObject({
  title: z.string().trim().min(1).optional(),
  content: z.string().trim().min(1).optional(),
  scopeType: announcementScopeTypeSchema.optional(),
  targetOrganizationIds: targetOrganizationIdsSchema.optional(),
  expiresAt: z.string().datetime().nullable().optional(),
}).superRefine((input, context) => {
  if (input.scopeType === "system" && (input.targetOrganizationIds?.length ?? 0) > 0) {
    addTargetIssue(context, "System announcements cannot have organization targets.");
  }
  if (input.scopeType === "organization" && input.targetOrganizationIds?.length === 0) {
    addTargetIssue(context, "Organization announcements require at least one target.");
  }
});

export const listAnnouncementsQuerySchema = strictObject({
  status: announcementStatusSchema.optional(),
  scopeType: announcementScopeTypeSchema.optional(),
  publishedFrom: z.string().datetime().optional(),
  publishedTo: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const listCurrentAnnouncementsQuerySchema = strictObject({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
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
export type ListAnnouncementsQuery = z.infer<typeof listAnnouncementsQuerySchema>;
export type ListCurrentAnnouncementsQuery = z.infer<typeof listCurrentAnnouncementsQuerySchema>;
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

function validateAnnouncementScope(
  input: { scopeType: "system" | "organization"; targetOrganizationIds: string[] },
  context: z.RefinementCtx,
): void {
  if (input.scopeType === "system" && input.targetOrganizationIds.length > 0) {
    addTargetIssue(context, "System announcements cannot have organization targets.");
  }
  if (input.scopeType === "organization" && input.targetOrganizationIds.length === 0) {
    addTargetIssue(context, "Organization announcements require at least one target.");
  }
}

function addTargetIssue(context: z.RefinementCtx, message: string): void {
  context.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["targetOrganizationIds"],
    message,
  });
}
