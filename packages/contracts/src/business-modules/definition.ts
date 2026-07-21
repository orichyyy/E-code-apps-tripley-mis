import { z } from "zod";

import { localizedMessageSchema, localeSchema, moduleCodeSchema } from "./common";
import {
  apiContributionSchema,
  dataResourceContributionSchema,
  dictionaryDependencyContributionSchema,
  domainEventContributionSchema,
  fieldContributionSchema,
  fileAttachmentContributionSchema,
  i18nMessageContributionSchema,
  importExportContributionSchema,
  menuContributionSchema,
  moduleErrorContributionSchema,
  notificationEventContributionSchema,
  operationEventContributionSchema,
  permissionContributionSchema,
  routeContributionSchema,
  scheduledJobContributionSchema,
} from "./contributions";

export const businessModuleContributionsSchema = z
  .object({
    permissions: z.array(permissionContributionSchema).default([]),
    apis: z.array(apiContributionSchema).default([]),
    routes: z.array(routeContributionSchema).default([]),
    menus: z.array(menuContributionSchema).default([]),
    dataResources: z.array(dataResourceContributionSchema).default([]),
    fields: z.array(fieldContributionSchema).default([]),
    operationEvents: z.array(operationEventContributionSchema).default([]),
    importExportResources: z.array(importExportContributionSchema).default([]),
    fileAttachments: z.array(fileAttachmentContributionSchema).default([]),
    domainEvents: z.array(domainEventContributionSchema).default([]),
    notificationEvents: z.array(notificationEventContributionSchema).default([]),
    i18nMessages: z.array(i18nMessageContributionSchema).default([]),
    dictionaryDependencies: z.array(dictionaryDependencyContributionSchema).default([]),
    scheduledJobs: z.array(scheduledJobContributionSchema).default([]),
    errors: z.array(moduleErrorContributionSchema).default([]),
  })
  .strict();

export const businessModuleDefinitionSchema = z
  .object({
    contractVersion: z.literal(1),
    moduleCode: moduleCodeSchema,
    defaultLocale: localeSchema,
    title: localizedMessageSchema,
    description: localizedMessageSchema.optional(),
    contributions: businessModuleContributionsSchema.default({}),
  })
  .strict();

export type BusinessModuleContributions = z.infer<typeof businessModuleContributionsSchema>;
export type BusinessModuleDefinition = z.infer<typeof businessModuleDefinitionSchema>;
export type BusinessModuleDefinitionInput = z.input<typeof businessModuleDefinitionSchema>;

export function normalizeBusinessModuleDefinition(
  input: BusinessModuleDefinitionInput,
): BusinessModuleDefinition {
  return businessModuleDefinitionSchema.parse(input);
}
