import type { OpenApiSchema } from "./types";

export const idSchema: OpenApiSchema = {
  type: "string",
  description: "Database auto-increment ID serialized as a string.",
};
export const nullableIdSchema: OpenApiSchema = { ...idSchema, nullable: true };
export const dateTimeSchema: OpenApiSchema = { type: "string", format: "date-time" };
export const nullableDateTimeSchema: OpenApiSchema = { ...dateTimeSchema, nullable: true };
export const nullableStringSchema: OpenApiSchema = { type: "string", nullable: true };

export function enumSchema(values: string[]): OpenApiSchema {
  return { type: "string", enum: values };
}

export function envelopeSchema(data: OpenApiSchema): OpenApiSchema {
  return {
    type: "object",
    required: ["data"],
    properties: { data },
    additionalProperties: true,
  };
}

export function objectEnvelope(schemaRef: string): OpenApiSchema {
  return envelopeSchema({ $ref: `#/components/schemas/${schemaRef}` });
}

export function arrayEnvelope(schemaRef: string): OpenApiSchema {
  return envelopeSchema({
    type: "array",
    items: { $ref: `#/components/schemas/${schemaRef}` },
  });
}

export function pageDataSchema(schemaRef: string): OpenApiSchema {
  return {
    type: "object",
    required: ["items", "page", "pageSize", "total", "totalPages"],
    properties: {
      items: { type: "array", items: { $ref: `#/components/schemas/${schemaRef}` } },
      page: { type: "integer" },
      pageSize: { type: "integer" },
      total: { type: "integer" },
      totalPages: { type: "integer" },
    },
    additionalProperties: false,
  };
}

export function pageEnvelope(schemaRef: string): OpenApiSchema {
  return envelopeSchema(pageDataSchema(schemaRef));
}

export function optionallyPagedEnvelope(schemaRef: string): OpenApiSchema {
  return envelopeSchema({
    anyOf: [
      { type: "array", items: { $ref: `#/components/schemas/${schemaRef}` } },
      pageDataSchema(schemaRef),
    ],
  });
}

export const actorAuditProperties: Record<string, OpenApiSchema> = {
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
  createdBy: nullableIdSchema,
  updatedBy: nullableIdSchema,
};

export const softDeleteProperties: Record<string, OpenApiSchema> = {
  isDeleted: { type: "boolean" },
  deletedAt: nullableDateTimeSchema,
  deletedBy: nullableIdSchema,
};
