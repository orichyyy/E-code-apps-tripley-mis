import { z } from "zod";

export const inAppNotificationDispatchJobType = "notification.in_app.dispatch" as const;

export const inAppNotificationDispatchPayloadSchema = z
  .object({
    recipientUserIds: z.array(z.string().min(1)).min(1),
    title: z.string().min(1),
    body: z.string().min(1),
    metadata: z.record(z.unknown()).default({}),
    createdBy: z.string().nullable().default(null),
    enqueuedAt: z.string().datetime()
  })
  .strict();

export type InAppNotificationDispatchPayload = z.infer<typeof inAppNotificationDispatchPayloadSchema>;
