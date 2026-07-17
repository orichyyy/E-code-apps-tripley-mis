import { z } from "zod";

const strictObject = <T extends z.ZodRawShape>(shape: T) => z.object(shape).strict();
const primitiveTemplateValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const emailDeliveryStatusSchema = z.enum([
  "pending",
  "running",
  "succeeded",
  "failed",
  "canceled",
]);

export const emailNotificationRequestSchema = strictObject({
  requestKey: z.string().min(1).max(200),
  userId: z.string().regex(/^\d+$/),
  templateCode: z.string().min(1).max(200),
  variables: z.record(primitiveTemplateValueSchema),
  referenceType: z.string().min(1).max(100).nullable().optional(),
  referenceId: z.string().min(1).max(200).nullable().optional(),
});

export const emailDeliveryListQuerySchema = strictObject({
  userId: z.string().regex(/^\d+$/).optional(),
  templateCode: z.string().min(1).optional(),
  locale: z.string().min(1).optional(),
  status: emailDeliveryStatusSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type EmailNotificationRequest = z.infer<typeof emailNotificationRequestSchema>;
export type EmailDeliveryListQuery = z.infer<typeof emailDeliveryListQuerySchema>;
export type EmailDeliveryStatus = z.infer<typeof emailDeliveryStatusSchema>;

export type EmailDeliverySummary = {
  id: string;
  requestKey: string;
  userId: string;
  templateId: string;
  templateCode: string;
  locale: string;
  maskedRecipient: string;
  status: EmailDeliveryStatus;
  attempt: number;
  maxAttempts: number;
  createdAt: string;
  updatedAt: string;
  succeededAt: string | null;
  failedAt: string | null;
  canceledAt: string | null;
  contentPurgedAt: string | null;
};

export type EmailDeliveryAttempt = {
  id: string;
  deliveryId: string;
  attemptNumber: number;
  status: "succeeded" | "failed";
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  smtpCode: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
};

export type EmailDeliveryDetail = EmailDeliverySummary & {
  referenceType: string | null;
  referenceId: string | null;
  lastSmtpCode: number | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  attempts: EmailDeliveryAttempt[];
};
