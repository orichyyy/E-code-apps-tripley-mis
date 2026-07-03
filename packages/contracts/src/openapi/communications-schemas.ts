import type { OpenApiDocument, OpenApiSchema } from "./types";

const idStringSchema: OpenApiSchema = {
  type: "string",
  description: "Database auto-increment ID serialized as a string."
};

const envelopeSchema = (data: OpenApiSchema): OpenApiSchema => ({
  type: "object",
  required: ["data"],
  properties: { data },
  additionalProperties: true
});

const auditProperties: Record<string, OpenApiSchema> = {
  createdAt: { type: "string", format: "date-time" },
  updatedAt: { type: "string", format: "date-time" },
  createdBy: { ...idStringSchema, nullable: true },
  updatedBy: { ...idStringSchema, nullable: true },
  isDeleted: { type: "boolean" },
  deletedAt: { type: "string", format: "date-time", nullable: true },
  deletedBy: { ...idStringSchema, nullable: true }
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
    "updatedBy"
  ],
  properties: {
    id: idStringSchema,
    tenantId: { ...idStringSchema, nullable: true },
    title: { type: "string" },
    content: { type: "string" },
    scopeType: { type: "string", enum: ["system", "organization"] },
    status: { type: "string", enum: ["draft", "published", "deleted"] },
    publishedAt: { type: "string", format: "date-time", nullable: true },
    ...auditProperties
  },
  additionalProperties: false
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
    "status",
    "isDeleted",
    "deletedAt",
    "deletedBy",
    "createdAt",
    "updatedAt",
    "createdBy",
    "updatedBy"
  ],
  properties: {
    id: idStringSchema,
    tenantId: { ...idStringSchema, nullable: true },
    name: { type: "string" },
    url: { type: "string", format: "uri" },
    eventTypes: { type: "array", items: { type: "string" } },
    secretConfigured: { type: "boolean" },
    status: { type: "string", enum: ["enabled", "disabled"] },
    ...auditProperties
  },
  additionalProperties: false
};

export const communicationsComponentSchemas: OpenApiDocument["components"]["schemas"] = {
  CreateAnnouncementRequest: {
    type: "object",
    required: ["title", "content"],
    properties: {
      title: { type: "string" },
      content: { type: "string" },
      scopeType: { type: "string", enum: ["system", "organization"] }
    },
    additionalProperties: false
  },
  UpdateAnnouncementRequest: {
    type: "object",
    properties: {
      title: { type: "string" },
      content: { type: "string" },
      scopeType: { type: "string", enum: ["system", "organization"] }
    },
    additionalProperties: false
  },
  CreateWebhookSubscriptionRequest: {
    type: "object",
    required: ["name", "url"],
    properties: {
      name: { type: "string" },
      url: { type: "string", format: "uri" },
      eventTypes: { type: "array", items: { type: "string" } },
      secret: { type: "string", nullable: true },
      status: { type: "string", enum: ["enabled", "disabled"] }
    },
    additionalProperties: false
  },
  UpdateWebhookSubscriptionRequest: {
    type: "object",
    properties: {
      name: { type: "string" },
      url: { type: "string", format: "uri" },
      eventTypes: { type: "array", items: { type: "string" } },
      secret: { type: "string", nullable: true },
      status: { type: "string", enum: ["enabled", "disabled"] }
    },
    additionalProperties: false
  },
  Announcement: announcementSchema,
  WebhookSubscription: webhookSubscriptionSchema,
  AnnouncementListResponse: envelopeSchema({
    type: "array",
    items: { $ref: "#/components/schemas/Announcement" }
  }),
  AnnouncementResponse: envelopeSchema({
    anyOf: [{ $ref: "#/components/schemas/Announcement" }, { type: "null" }]
  }),
  WebhookSubscriptionListResponse: envelopeSchema({
    type: "array",
    items: { $ref: "#/components/schemas/WebhookSubscription" }
  }),
  WebhookSubscriptionResponse: envelopeSchema({
    anyOf: [{ $ref: "#/components/schemas/WebhookSubscription" }, { type: "null" }]
  })
};
