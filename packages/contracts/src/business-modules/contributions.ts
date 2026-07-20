import { z } from "zod";

import {
  apiLogLevelSchema,
  apiMethodSchema,
  localizedMessageSchema,
  localeSchema,
  namespacedCodeSchema,
} from "./common";

const schemaId = z.string().min(1);
const fieldCode = z.string().regex(/^[a-z][a-zA-Z0-9]*$/);

export const permissionContributionSchema = z
  .object({
    code: namespacedCodeSchema,
    description: localizedMessageSchema,
    permissionType: z.enum(["menu", "page", "action", "api", "data", "field"]),
  })
  .strict();

export const apiContributionSchema = z
  .object({
    code: namespacedCodeSchema,
    method: apiMethodSchema,
    path: z.string().startsWith("/api/modules/"),
    description: localizedMessageSchema,
    requiredPermission: namespacedCodeSchema,
    logLevel: apiLogLevelSchema,
    requestSchemaId: schemaId,
    responseSchemaId: schemaId,
    operationEventCode: namespacedCodeSchema.optional(),
    resourceAccess: z
      .object({
        resourceType: namespacedCodeSchema,
        requestScenario: z.enum(["create", "edit"]).optional(),
        responseScenario: z.enum(["list", "detail"]).optional(),
      })
      .strict()
      .refine((value) => value.requestScenario || value.responseScenario, {
        message: "At least one request or response scenario is required.",
      })
      .optional(),
  })
  .strict();

export const routeContributionSchema = z
  .object({
    routeCode: namespacedCodeSchema,
    path: z.string().startsWith("/modules/"),
    title: localizedMessageSchema,
    requiredPermission: namespacedCodeSchema,
    menuVisible: z.boolean(),
    sortOrder: z.number().int().optional(),
  })
  .strict();

export const menuContributionSchema = z
  .object({
    code: namespacedCodeSchema,
    path: z.string().startsWith("/modules/"),
    title: localizedMessageSchema,
    parentCode: z.string().min(1).optional(),
    routeCode: namespacedCodeSchema.optional(),
    requiredPermission: namespacedCodeSchema.optional(),
    sortOrder: z.number().int(),
    visible: z.boolean().optional(),
  })
  .strict();

export const dataResourceContributionSchema = z
  .object({
    resourceType: namespacedCodeSchema,
    permissionCode: namespacedCodeSchema,
    title: localizedMessageSchema,
    accessModel: z.enum(["global", "policy"]),
    fields: z
      .array(
        z
          .object({
            code: fieldCode,
            title: localizedMessageSchema,
            valueType: z.enum(["string", "number", "boolean", "date", "datetime", "id"]),
          })
          .strict(),
      )
      .default([]),
    ownerUserField: fieldCode.optional(),
    organizationField: fieldCode.optional(),
    operatorCodes: z.array(namespacedCodeSchema).default([]),
  })
  .strict();

export const fieldContributionSchema = z
  .object({
    resourceType: namespacedCodeSchema,
    field: fieldCode,
    title: localizedMessageSchema,
    scenarios: z.array(z.enum(["list", "detail", "create", "edit"])).min(1),
  })
  .strict();

export const operationEventContributionSchema = z
  .object({
    code: namespacedCodeSchema,
    title: localizedMessageSchema,
    resourceType: namespacedCodeSchema,
    sensitiveFields: z.array(fieldCode).default([]),
  })
  .strict();

const csvColumnSchema = z
  .object({
    code: fieldCode,
    title: localizedMessageSchema,
    valueType: z.enum(["string", "number", "boolean", "date", "datetime", "id"]),
    required: z.boolean().optional(),
  })
  .strict();

export const importExportContributionSchema = z
  .object({
    resourceType: z.string().min(3),
    title: localizedMessageSchema,
    capabilities: z.array(z.enum(["import", "export"])).min(1),
    columns: z.array(csvColumnSchema).min(1),
    exportFields: z.array(fieldCode).default([]),
  })
  .strict();

export const fileAttachmentContributionSchema = z
  .object({
    attachmentCode: namespacedCodeSchema,
    resourceType: namespacedCodeSchema,
    title: localizedMessageSchema,
    cardinality: z.enum(["single", "multiple"]),
    allowedExtensions: z.array(z.string().regex(/^[a-z0-9]+$/)).min(1),
    maxSizeBytes: z.number().int().positive(),
  })
  .strict();

export const domainEventContributionSchema = z
  .object({
    eventType: namespacedCodeSchema,
    title: localizedMessageSchema,
    payloadSchemaId: schemaId,
  })
  .strict();

export const notificationEventContributionSchema = z
  .object({
    eventType: namespacedCodeSchema,
    title: localizedMessageSchema,
    payloadSchemaId: schemaId,
    channels: z.array(z.enum(["in_app", "email", "webhook"])).min(1),
    templateCodes: z.record(z.enum(["in_app", "email", "webhook"]), z.string().min(1)),
  })
  .strict();

export const i18nMessageContributionSchema = z
  .object({
    key: z.string().min(1),
    defaultMessage: z.string().min(1),
    translations: z.record(z.string(), z.string().min(1)).default({}),
  })
  .strict()
  .superRefine((message, context) => {
    for (const locale of Object.keys(message.translations)) {
      if (!localeSchema.safeParse(locale).success) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["translations", locale],
          message: "Expected a canonical BCP 47 language tag.",
        });
      }
    }
  });

export const dictionaryDependencyContributionSchema = z
  .object({
    code: z.string().min(1),
  })
  .strict();

export const scheduledJobContributionSchema = z
  .object({
    jobType: namespacedCodeSchema,
    title: localizedMessageSchema,
    parameterSchemaId: schemaId,
    executionMode: z.enum(["perServer", "singleton"]),
    defaultTimeoutSeconds: z.number().int().positive(),
    maxTimeoutSeconds: z.number().int().positive(),
    defaultMaxAttempts: z.number().int().positive(),
    maxAttempts: z.number().int().positive(),
  })
  .strict();

export const moduleErrorContributionSchema = z
  .object({
    code: z.string().regex(/^BUSINESS_[A-Z][A-Z0-9_]*$/),
    status: z.number().int().min(400).max(599),
    message: localizedMessageSchema,
    detailsSchemaId: schemaId.optional(),
  })
  .strict();

export type PermissionContribution = z.infer<typeof permissionContributionSchema>;
export type ApiContribution = z.infer<typeof apiContributionSchema>;
export type RouteContribution = z.infer<typeof routeContributionSchema>;
export type MenuContribution = z.infer<typeof menuContributionSchema>;
export type DataResourceContribution = z.infer<typeof dataResourceContributionSchema>;
export type FieldContribution = z.infer<typeof fieldContributionSchema>;
export type OperationEventContribution = z.infer<typeof operationEventContributionSchema>;
export type ImportExportContribution = z.infer<typeof importExportContributionSchema>;
export type FileAttachmentContribution = z.infer<typeof fileAttachmentContributionSchema>;
export type DomainEventContribution = z.infer<typeof domainEventContributionSchema>;
export type NotificationEventContribution = z.infer<typeof notificationEventContributionSchema>;
export type I18nMessageContribution = z.infer<typeof i18nMessageContributionSchema>;
export type DictionaryDependencyContribution = z.infer<
  typeof dictionaryDependencyContributionSchema
>;
export type ScheduledJobContribution = z.infer<typeof scheduledJobContributionSchema>;
export type ModuleErrorContribution = z.infer<typeof moduleErrorContributionSchema>;
