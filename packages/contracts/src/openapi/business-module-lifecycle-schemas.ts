import type { OpenApiDocument, OpenApiSchema } from "./types";

const hash: OpenApiSchema = { type: "string", pattern: "^[a-f0-9]{64}$" };
const localizedMessage: OpenApiSchema = {
  type: "object",
  required: ["key", "defaultMessage"],
  properties: {
    key: { type: "string" },
    defaultMessage: { type: "string" },
  },
  additionalProperties: false,
};
const dependencyFailure: OpenApiSchema = {
  type: "object",
  required: ["moduleCode", "dictionaryTypeCode", "reason"],
  properties: {
    moduleCode: { type: "string" },
    dictionaryTypeCode: { type: "string" },
    reason: { type: "string", enum: ["missing_or_disabled"] },
  },
  additionalProperties: false,
};
const authorizationBindingRemoval: OpenApiSchema = {
  type: "object",
  required: ["permissionCode", "roleBindingCount", "dataRuleCount", "userOverrideCount"],
  properties: {
    permissionCode: { type: "string" },
    roleBindingCount: { type: "integer", minimum: 0 },
    dataRuleCount: { type: "integer", minimum: 0 },
    userOverrideCount: { type: "integer", minimum: 0 },
  },
  additionalProperties: false,
};
const syncPlanChange: OpenApiSchema = {
  type: "object",
  required: ["type", "moduleCode", "drift", "authorizationBindingsRemoved"],
  properties: {
    type: { type: "string", enum: ["add", "update", "disable"] },
    moduleCode: { type: "string" },
    drift: {
      type: "string",
      enum: ["none", "new", "presentation", "activation", "reintroduced", "removed"],
    },
    authorizationBindingsRemoved: {
      type: "array",
      items: authorizationBindingRemoval,
    },
  },
  additionalProperties: false,
};
const registryItem: OpenApiSchema = {
  type: "object",
  required: [
    "moduleCode",
    "defaultLocale",
    "title",
    "description",
    "definitionHash",
    "activationHash",
    "acceptedDefinitionHash",
    "acceptedActivationHash",
    "state",
    "drift",
    "contributionCounts",
    "dependencyFailures",
    "acceptedAt",
    "acceptedBy",
  ],
  properties: {
    moduleCode: { type: "string" },
    defaultLocale: { type: "string" },
    title: localizedMessage,
    description: { ...localizedMessage, nullable: true },
    definitionHash: { ...hash, nullable: true },
    activationHash: { ...hash, nullable: true },
    acceptedDefinitionHash: { ...hash, nullable: true },
    acceptedActivationHash: { ...hash, nullable: true },
    state: { type: "string", enum: ["active", "pending", "disabled"] },
    drift: {
      type: "string",
      enum: ["none", "new", "presentation", "activation", "reintroduced", "removed"],
    },
    contributionCounts: { type: "object", additionalProperties: { type: "integer" } },
    dependencyFailures: { type: "array", items: dependencyFailure },
    acceptedAt: { type: "string", format: "date-time", nullable: true },
    acceptedBy: { type: "string", nullable: true },
  },
  additionalProperties: false,
};
const envelope = (data: OpenApiSchema): OpenApiSchema => ({
  type: "object",
  required: ["data"],
  properties: { data },
  additionalProperties: true,
});

export const businessModuleLifecycleComponentSchemas: OpenApiDocument["components"]["schemas"] = {
  ApplyModuleSyncRequest: {
    type: "object",
    required: ["expectedRegistryHash", "confirmed"],
    properties: {
      expectedRegistryHash: hash,
      confirmed: { type: "boolean", description: "Must be true to confirm Apply." },
    },
    additionalProperties: false,
  },
  BusinessModuleRegistryItem: registryItem,
  BusinessModuleRegistryResponse: envelope({
    type: "object",
    required: ["registryHash", "acceptedRegistryHash", "modules"],
    properties: {
      registryHash: hash,
      acceptedRegistryHash: { ...hash, nullable: true },
      modules: { type: "array", items: registryItem },
    },
    additionalProperties: false,
  }),
  ModuleSyncPlanResponse: envelope({
    type: "object",
    required: ["registryHash", "acceptedRegistryHash", "changes", "dependencyFailures", "canApply"],
    properties: {
      registryHash: hash,
      acceptedRegistryHash: { ...hash, nullable: true },
      changes: { type: "array", items: syncPlanChange },
      dependencyFailures: { type: "array", items: dependencyFailure },
      canApply: { type: "boolean" },
    },
    additionalProperties: false,
  }),
  ModuleSyncApplyResponse: envelope({
    type: "object",
    required: ["applied", "registryHash", "acceptedAt", "modules"],
    properties: {
      applied: { type: "boolean" },
      registryHash: hash,
      acceptedAt: { type: "string", format: "date-time" },
      modules: { type: "array", items: registryItem },
    },
    additionalProperties: false,
  }),
};
