import { z } from "zod";

import type { BusinessModuleDefinition } from "./business-modules";

const nullableId = z.string().min(1).nullable();

export const baseWebhookEventTypes = [
  "user.created",
  "job.failed",
  "permission.changed",
  "notification.requested",
] as const;

export const webhookEventTypeSchema = z.string().min(3);

export type WebhookEventType = z.infer<typeof webhookEventTypeSchema>;

export const webhookEventCatalog = [
  { type: "user.created", description: "A user was created." },
  { type: "job.failed", description: "A queue or scheduled job exhausted its attempts." },
  { type: "permission.changed", description: "Persisted permission state changed." },
  { type: "notification.requested", description: "A directed webhook notification was requested." },
] as const satisfies ReadonlyArray<{ type: WebhookEventType; description: string }>;

export type WebhookEventCatalogEntry = { type: string; description: string };

export function createWebhookEventCatalog(
  definitions: readonly BusinessModuleDefinition[],
): WebhookEventCatalogEntry[] {
  const moduleEvents = definitions.flatMap((definition) => [
    ...definition.contributions.domainEvents.map((event) => ({
      type: event.eventType,
      description: event.title.defaultMessage,
    })),
    ...definition.contributions.notificationEvents.map((event) => ({
      type: event.eventType,
      description: event.title.defaultMessage,
    })),
  ]);
  return [...webhookEventCatalog, ...moduleEvents].sort((left, right) =>
    left.type.localeCompare(right.type),
  );
}

const baseOutboxEventShape = {
  subject: z.string().min(1),
  occurredAt: z.string().datetime(),
};

export const webhookOutboxEventSchema = z.discriminatedUnion("type", [
  z
    .object({
      ...baseOutboxEventShape,
      type: z.literal("user.created"),
      data: z
        .object({
          userId: z.string().min(1),
          primaryOrganizationId: z.string().min(1),
          createdByUserId: nullableId,
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...baseOutboxEventShape,
      type: z.literal("job.failed"),
      data: z
        .object({
          jobId: z.string().min(1),
          jobKind: z.enum(["queue", "scheduled"]),
          jobCode: z.string().min(1),
          attempt: z.number().int().positive(),
          maxAttempts: z.number().int().positive(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...baseOutboxEventShape,
      type: z.literal("permission.changed"),
      data: z
        .object({
          targetType: z.enum(["role", "user", "userOrganizationBinding", "system"]),
          targetId: z.string().min(1),
          organizationId: nullableId,
          changeType: z.enum([
            "rolePermissions",
            "dataPermissions",
            "fieldPermissions",
            "userOverrides",
            "roleBinding",
            "manifestSync",
          ]),
          changedByUserId: nullableId,
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...baseOutboxEventShape,
      type: z.literal("notification.requested"),
      targetSubscriptionId: z.string().min(1),
      data: z
        .object({
          notificationId: z.string().min(1),
          subject: z.string().min(1),
          body: z.string().min(1),
          locale: z.string().min(1),
          referenceType: z.string().min(1).nullable(),
          referenceId: nullableId,
        })
        .strict(),
    })
    .strict(),
]);

export type WebhookOutboxEvent = z.infer<typeof webhookOutboxEventSchema>;

export const businessModuleWebhookOutboxEventSchema = z
  .object({
    type: z.string().min(3),
    subject: z.string().min(1),
    occurredAt: z.string().datetime(),
    data: z.record(z.unknown()),
  })
  .strict();

export type BusinessModuleWebhookOutboxEvent = z.infer<
  typeof businessModuleWebhookOutboxEventSchema
>;

export const cloudEventEnvelopeSchema = z
  .object({
    specversion: z.literal("1.0"),
    id: z.string().min(1),
    type: webhookEventTypeSchema,
    source: z.string().min(1),
    time: z.string().datetime(),
    subject: z.string().min(1),
    datacontenttype: z.literal("application/json"),
    data: z.record(z.unknown()),
  })
  .strict();

export type CloudEventEnvelope = z.infer<typeof cloudEventEnvelopeSchema>;

export function createCloudEventEnvelope(
  id: string,
  source: string,
  event: WebhookOutboxEvent | BusinessModuleWebhookOutboxEvent,
): CloudEventEnvelope {
  return cloudEventEnvelopeSchema.parse({
    specversion: "1.0",
    id,
    type: event.type,
    source,
    time: event.occurredAt,
    subject: event.subject,
    datacontenttype: "application/json",
    data: event.data,
  });
}
