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

const systemConfigSchema: OpenApiSchema = {
  type: "object",
  required: [
    "id",
    "tenantId",
    "configKey",
    "configValue",
    "valueType",
    "groupKey",
    "description",
    "editable",
    "status",
    "updatedAt"
  ],
  properties: {
    id: idStringSchema,
    tenantId: { ...idStringSchema, nullable: true },
    configKey: { type: "string" },
    configValue: { description: "Configuration value matching valueType." },
    valueType: { type: "string", enum: ["string", "number", "boolean", "json"] },
    groupKey: { type: "string" },
    description: { type: "string", nullable: true },
    editable: { type: "boolean" },
    status: { type: "string", enum: ["enabled", "disabled"] },
    updatedAt: { type: "string", format: "date-time" }
  },
  additionalProperties: false
};

const dictionaryTypeSchema: OpenApiSchema = {
  type: "object",
  required: ["id", "tenantId", "code", "name", "description", "status"],
  properties: {
    id: idStringSchema,
    tenantId: { ...idStringSchema, nullable: true },
    code: { type: "string" },
    name: { type: "string" },
    description: { type: "string", nullable: true },
    status: { type: "string", enum: ["enabled", "disabled"] }
  },
  additionalProperties: false
};

const dictionaryItemSchema: OpenApiSchema = {
  type: "object",
  required: ["id", "tenantId", "typeId", "itemValue", "labelI18nKey", "sortOrder", "status"],
  properties: {
    id: idStringSchema,
    tenantId: { ...idStringSchema, nullable: true },
    typeId: idStringSchema,
    itemValue: { type: "string" },
    labelI18nKey: { type: "string" },
    sortOrder: { type: "integer" },
    status: { type: "string", enum: ["enabled", "disabled"] }
  },
  additionalProperties: false
};

const i18nMessageSchema: OpenApiSchema = {
  type: "object",
  required: ["id", "tenantId", "messageKey", "language", "messageValue", "module", "updatedAt"],
  properties: {
    id: idStringSchema,
    tenantId: { ...idStringSchema, nullable: true },
    messageKey: { type: "string" },
    language: { type: "string" },
    messageValue: { type: "string" },
    module: { type: "string" },
    updatedAt: { type: "string", format: "date-time" }
  },
  additionalProperties: false
};

export const systemManagementComponentSchemas: OpenApiDocument["components"]["schemas"] = {
  UpdateSystemConfigRequest: {
    type: "object",
    required: ["configValue"],
    properties: {
      configValue: {}
    },
    additionalProperties: false
  },
  CreateDictionaryTypeRequest: {
    type: "object",
    required: ["code", "name"],
    properties: {
      code: { type: "string" },
      name: { type: "string" },
      description: { type: "string", nullable: true },
      status: { type: "string", enum: ["enabled", "disabled"] }
    },
    additionalProperties: false
  },
  UpdateDictionaryTypeRequest: {
    type: "object",
    properties: {
      code: { type: "string" },
      name: { type: "string" },
      description: { type: "string", nullable: true },
      status: { type: "string", enum: ["enabled", "disabled"] }
    },
    additionalProperties: false
  },
  CreateDictionaryItemRequest: {
    type: "object",
    required: ["itemValue", "labelI18nKey"],
    properties: {
      itemValue: { type: "string" },
      labelI18nKey: { type: "string" },
      sortOrder: { type: "integer" },
      status: { type: "string", enum: ["enabled", "disabled"] }
    },
    additionalProperties: false
  },
  UpdateDictionaryItemRequest: {
    type: "object",
    properties: {
      itemValue: { type: "string" },
      labelI18nKey: { type: "string" },
      sortOrder: { type: "integer" },
      status: { type: "string", enum: ["enabled", "disabled"] }
    },
    additionalProperties: false
  },
  UpdateI18nMessageRequest: {
    type: "object",
    required: ["messageValue"],
    properties: {
      messageValue: { type: "string" }
    },
    additionalProperties: false
  },
  SystemConfig: systemConfigSchema,
  DictionaryType: dictionaryTypeSchema,
  DictionaryItem: dictionaryItemSchema,
  I18nMessage: i18nMessageSchema,
  SystemConfigListResponse: envelopeSchema({
    type: "array",
    items: { $ref: "#/components/schemas/SystemConfig" }
  }),
  SystemConfigResponse: envelopeSchema({
    anyOf: [{ $ref: "#/components/schemas/SystemConfig" }, { type: "null" }]
  }),
  DictionaryTypeListResponse: envelopeSchema({
    type: "array",
    items: { $ref: "#/components/schemas/DictionaryType" }
  }),
  DictionaryTypeResponse: envelopeSchema({
    anyOf: [{ $ref: "#/components/schemas/DictionaryType" }, { type: "null" }]
  }),
  DictionaryItemListResponse: envelopeSchema({
    type: "array",
    items: { $ref: "#/components/schemas/DictionaryItem" }
  }),
  DictionaryItemResponse: envelopeSchema({
    anyOf: [{ $ref: "#/components/schemas/DictionaryItem" }, { type: "null" }]
  }),
  I18nMessageListResponse: envelopeSchema({
    type: "array",
    items: { $ref: "#/components/schemas/I18nMessage" }
  }),
  I18nMessageResponse: envelopeSchema({
    anyOf: [{ $ref: "#/components/schemas/I18nMessage" }, { type: "null" }]
  })
};
