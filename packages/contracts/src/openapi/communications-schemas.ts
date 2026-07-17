import type { OpenApiDocument, OpenApiSchema } from "./types";

const idStringSchema: OpenApiSchema = {
  type: "string",
  description: "Database auto-increment ID serialized as a string.",
};

const envelopeSchema = (data: OpenApiSchema): OpenApiSchema => ({
  type: "object",
  required: ["data"],
  properties: { data },
  additionalProperties: true,
});

const auditProperties: Record<string, OpenApiSchema> = {
  createdAt: { type: "string", format: "date-time" },
  updatedAt: { type: "string", format: "date-time" },
  createdBy: { ...idStringSchema, nullable: true },
  updatedBy: { ...idStringSchema, nullable: true },
  isDeleted: { type: "boolean" },
  deletedAt: { type: "string", format: "date-time", nullable: true },
  deletedBy: { ...idStringSchema, nullable: true },
};

const announcementSchema: OpenApiSchema = {
  type: "object",
  required: [
    "id",
    "tenantId",
    "title",
    "content",
    "scopeType",
    "status",
    "publishedAt",
    "isDeleted",
    "deletedAt",
    "deletedBy",
    "createdAt",
    "updatedAt",
    "createdBy",
    "updatedBy",
  ],
  properties: {
    id: idStringSchema,
    tenantId: { ...idStringSchema, nullable: true },
    title: { type: "string" },
    content: { type: "string" },
    scopeType: { type: "string", enum: ["system", "organization"] },
    status: { type: "string", enum: ["draft", "published", "deleted"] },
    publishedAt: { type: "string", format: "date-time", nullable: true },
    ...auditProperties,
  },
  additionalProperties: false,
};

const webhookSubscriptionSchema: OpenApiSchema = {
  type: "object",
  required: [
    "id",
    "tenantId",
    "name",
    "url",
    "eventTypes",
    "secretConfigured",
    "revision",
    "status",
    "isDeleted",
    "deletedAt",
    "deletedBy",
    "createdAt",
    "updatedAt",
    "createdBy",
    "updatedBy",
  ],
  properties: {
    id: idStringSchema,
    tenantId: { ...idStringSchema, nullable: true },
    name: { type: "string" },
    url: { type: "string", format: "uri" },
    eventTypes: { type: "array", items: { type: "string" } },
    secretConfigured: { type: "boolean" },
    revision: { type: "integer" },
    status: { type: "string", enum: ["enabled", "disabled"] },
    ...auditProperties,
  },
  additionalProperties: false,
};

const webhookDeliverySchema: OpenApiSchema = {
  type: "object",
  required: [
    "id",
    "eventId",
    "subscriptionId",
    "subscriptionRevision",
    "eventType",
    "eventSource",
    "targetHost",
    "status",
    "attempt",
    "maxAttempts",
    "nextAttemptAt",
    "lastHttpStatus",
    "lastErrorCode",
    "lastErrorMessage",
    "succeededAt",
    "failedAt",
    "canceledAt",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    id: idStringSchema,
    eventId: idStringSchema,
    subscriptionId: idStringSchema,
    subscriptionRevision: { type: "integer" },
    eventType: {
      type: "string",
      enum: ["user.created", "job.failed", "permission.changed", "notification.requested"],
    },
    eventSource: { type: "string" },
    targetHost: { type: "string" },
    status: { type: "string", enum: ["pending", "running", "succeeded", "failed", "canceled"] },
    attempt: { type: "integer" },
    maxAttempts: { type: "integer" },
    nextAttemptAt: { type: "string", format: "date-time" },
    lastHttpStatus: { type: "integer", nullable: true },
    lastErrorCode: { type: "string", nullable: true },
    lastErrorMessage: { type: "string", nullable: true },
    succeededAt: { type: "string", format: "date-time", nullable: true },
    failedAt: { type: "string", format: "date-time", nullable: true },
    canceledAt: { type: "string", format: "date-time", nullable: true },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
  additionalProperties: false,
};

const webhookAttemptSchema: OpenApiSchema = {
  type: "object",
  required: [
    "id",
    "attemptNumber",
    "status",
    "startedAt",
    "finishedAt",
    "durationMs",
    "httpStatus",
    "errorCode",
    "errorMessage",
  ],
  properties: {
    id: idStringSchema,
    attemptNumber: { type: "integer" },
    status: { type: "string", enum: ["succeeded", "failed"] },
    startedAt: { type: "string", format: "date-time" },
    finishedAt: { type: "string", format: "date-time" },
    durationMs: { type: "integer" },
    httpStatus: { type: "integer", nullable: true },
    errorCode: { type: "string", nullable: true },
    errorMessage: { type: "string", nullable: true },
  },
  additionalProperties: false,
};

export const communicationsComponentSchemas: OpenApiDocument["components"]["schemas"] = {
  CreateAnnouncementRequest: {
    type: "object",
    required: ["title", "content"],
    properties: {
      title: { type: "string" },
      content: { type: "string" },
      scopeType: { type: "string", enum: ["system", "organization"] },
    },
    additionalProperties: false,
  },
  UpdateAnnouncementRequest: {
    type: "object",
    properties: {
      title: { type: "string" },
      content: { type: "string" },
      scopeType: { type: "string", enum: ["system", "organization"] },
    },
    additionalProperties: false,
  },
  CreateWebhookSubscriptionRequest: {
    type: "object",
    required: ["name", "url", "eventTypes"],
    properties: {
      name: { type: "string" },
      url: { type: "string", format: "uri" },
      eventTypes: {
        type: "array",
        items: {
          type: "string",
          enum: ["user.created", "job.failed", "permission.changed", "notification.requested"],
        },
      },
      secret: { type: "string", nullable: true },
      status: { type: "string", enum: ["enabled", "disabled"] },
    },
    additionalProperties: false,
  },
  UpdateWebhookSubscriptionRequest: {
    type: "object",
    properties: {
      name: { type: "string" },
      url: { type: "string", format: "uri" },
      eventTypes: {
        type: "array",
        items: {
          type: "string",
          enum: ["user.created", "job.failed", "permission.changed", "notification.requested"],
        },
      },
      secret: { type: "string", nullable: true },
      status: { type: "string", enum: ["enabled", "disabled"] },
    },
    additionalProperties: false,
  },
  Announcement: announcementSchema,
  WebhookSubscription: webhookSubscriptionSchema,
  WebhookDelivery: webhookDeliverySchema,
  WebhookDeliveryAttempt: webhookAttemptSchema,
  AnnouncementListResponse: envelopeSchema({
    type: "array",
    items: { $ref: "#/components/schemas/Announcement" },
  }),
  AnnouncementResponse: envelopeSchema({
    anyOf: [{ $ref: "#/components/schemas/Announcement" }, { type: "null" }],
  }),
  WebhookSubscriptionListResponse: envelopeSchema({
    type: "array",
    items: { $ref: "#/components/schemas/WebhookSubscription" },
  }),
  WebhookSubscriptionResponse: envelopeSchema({
    anyOf: [{ $ref: "#/components/schemas/WebhookSubscription" }, { type: "null" }],
  }),
  WebhookEventTypeListResponse: envelopeSchema({
    type: "array",
    items: {
      type: "object",
      required: ["type", "description"],
      properties: { type: { type: "string" }, description: { type: "string" } },
      additionalProperties: false,
    },
  }),
  WebhookDeliveryListResponse: envelopeSchema({
    type: "object",
    required: ["items", "page", "pageSize", "total"],
    properties: {
      items: { type: "array", items: { $ref: "#/components/schemas/WebhookDelivery" } },
      page: { type: "integer" },
      pageSize: { type: "integer" },
      total: { type: "integer" },
    },
    additionalProperties: false,
  }),
  WebhookDeliveryDetailResponse: envelopeSchema({
    anyOf: [
      {
        type: "object",
        required: [...(webhookDeliverySchema.required ?? []), "attempts"],
        properties: {
          ...(webhookDeliverySchema.properties ?? {}),
          attempts: {
            type: "array",
            items: { $ref: "#/components/schemas/WebhookDeliveryAttempt" },
          },
        },
        additionalProperties: false,
      },
      { type: "null" },
    ],
  }),
};
