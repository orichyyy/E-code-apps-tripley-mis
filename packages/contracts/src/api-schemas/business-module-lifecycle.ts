import { z } from "zod";

import { localizedMessageSchema, moduleCodeSchema } from "../business-modules/common";

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const businessModuleStateSchema = z.enum(["active", "pending", "disabled"]);
export const businessModuleDriftSchema = z.enum([
  "none",
  "new",
  "presentation",
  "activation",
  "reintroduced",
  "removed",
]);

export const businessModuleContributionCountsSchema = z
  .object({
    permissions: z.number().int().nonnegative(),
    apis: z.number().int().nonnegative(),
    routes: z.number().int().nonnegative(),
    menus: z.number().int().nonnegative(),
    dataResources: z.number().int().nonnegative(),
    fields: z.number().int().nonnegative(),
    operationEvents: z.number().int().nonnegative(),
    importExportResources: z.number().int().nonnegative(),
    fileAttachments: z.number().int().nonnegative(),
    domainEvents: z.number().int().nonnegative(),
    notificationEvents: z.number().int().nonnegative(),
    i18nMessages: z.number().int().nonnegative(),
    dictionaryDependencies: z.number().int().nonnegative(),
    scheduledJobs: z.number().int().nonnegative(),
    errors: z.number().int().nonnegative(),
  })
  .strict();

export const moduleDependencyFailureSchema = z
  .object({
    moduleCode: moduleCodeSchema,
    dictionaryTypeCode: z.string().min(1),
    reason: z.literal("missing_or_disabled"),
  })
  .strict();

export const moduleAuthorizationBindingRemovalSchema = z
  .object({
    permissionCode: z.string().min(1),
    roleBindingCount: z.number().int().nonnegative(),
    dataRuleCount: z.number().int().nonnegative(),
    userOverrideCount: z.number().int().nonnegative(),
  })
  .strict();

export const businessModuleRegistryItemSchema = z
  .object({
    moduleCode: moduleCodeSchema,
    defaultLocale: z.string().min(2),
    title: localizedMessageSchema,
    description: localizedMessageSchema.nullable(),
    definitionHash: hashSchema.nullable(),
    activationHash: hashSchema.nullable(),
    acceptedDefinitionHash: hashSchema.nullable(),
    acceptedActivationHash: hashSchema.nullable(),
    state: businessModuleStateSchema,
    drift: businessModuleDriftSchema,
    contributionCounts: businessModuleContributionCountsSchema,
    dependencyFailures: z.array(moduleDependencyFailureSchema),
    acceptedAt: z.string().datetime().nullable(),
    acceptedBy: z.string().regex(/^\d+$/).nullable(),
  })
  .strict();

export const businessModuleRegistryResponseSchema = z
  .object({
    registryHash: hashSchema,
    acceptedRegistryHash: hashSchema.nullable(),
    modules: z.array(businessModuleRegistryItemSchema),
  })
  .strict();

export const moduleSyncPlanChangeSchema = z
  .object({
    type: z.enum(["add", "update", "disable"]),
    moduleCode: moduleCodeSchema,
    drift: businessModuleDriftSchema,
    authorizationBindingsRemoved: z.array(moduleAuthorizationBindingRemovalSchema),
  })
  .strict();

export const moduleSyncPlanResponseSchema = z
  .object({
    registryHash: hashSchema,
    acceptedRegistryHash: hashSchema.nullable(),
    changes: z.array(moduleSyncPlanChangeSchema),
    dependencyFailures: z.array(moduleDependencyFailureSchema),
    canApply: z.boolean(),
  })
  .strict();

export const applyModuleSyncRequestSchema = z
  .object({
    expectedRegistryHash: hashSchema,
    confirmed: z.literal(true),
  })
  .strict();

export const moduleSyncApplyResponseSchema = z
  .object({
    applied: z.boolean(),
    registryHash: hashSchema,
    acceptedAt: z.string().datetime(),
    modules: z.array(businessModuleRegistryItemSchema),
  })
  .strict();

export type BusinessModuleState = z.infer<typeof businessModuleStateSchema>;
export type BusinessModuleDrift = z.infer<typeof businessModuleDriftSchema>;
export type BusinessModuleContributionCounts = z.infer<
  typeof businessModuleContributionCountsSchema
>;
export type ModuleDependencyFailure = z.infer<typeof moduleDependencyFailureSchema>;
export type ModuleAuthorizationBindingRemoval = z.infer<
  typeof moduleAuthorizationBindingRemovalSchema
>;
export type BusinessModuleRegistryItem = z.infer<typeof businessModuleRegistryItemSchema>;
export type BusinessModuleRegistryResponse = z.infer<typeof businessModuleRegistryResponseSchema>;
export type ModuleSyncPlanChange = z.infer<typeof moduleSyncPlanChangeSchema>;
export type ModuleSyncPlanResponse = z.infer<typeof moduleSyncPlanResponseSchema>;
export type ApplyModuleSyncRequest = z.infer<typeof applyModuleSyncRequestSchema>;
export type ModuleSyncApplyResponse = z.infer<typeof moduleSyncApplyResponseSchema>;
