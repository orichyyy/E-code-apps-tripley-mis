import { describe, expect, it } from "vitest";

import {
  applyModuleSyncRequestSchema,
  businessModuleRegistryResponseSchema,
  moduleSyncPlanResponseSchema,
  updateI18nMessageRequestSchema,
} from "../src";

const hash = "a".repeat(64);

describe("Business Module lifecycle contracts", () => {
  it("requires an explicit confirmation against an exact release registry hash", () => {
    expect(
      applyModuleSyncRequestSchema.parse({ expectedRegistryHash: hash, confirmed: true }),
    ).toEqual({ expectedRegistryHash: hash, confirmed: true });
    expect(
      applyModuleSyncRequestSchema.safeParse({ expectedRegistryHash: hash, confirmed: false })
        .success,
    ).toBe(false);
    expect(
      applyModuleSyncRequestSchema.safeParse({ expectedRegistryHash: "stale", confirmed: true })
        .success,
    ).toBe(false);
  });

  it("represents registry drift and dependency failures without runtime values", () => {
    const plan = moduleSyncPlanResponseSchema.parse({
      registryHash: hash,
      acceptedRegistryHash: null,
      changes: [
        {
          type: "add",
          moduleCode: "regional-ops",
          drift: "new",
          authorizationBindingsRemoved: [],
        },
      ],
      dependencyFailures: [
        {
          moduleCode: "regional-ops",
          dictionaryTypeCode: "region",
          reason: "missing_or_disabled",
        },
      ],
      canApply: false,
    });

    expect(plan.changes[0]?.drift).toBe("new");
    expect(plan.canApply).toBe(false);
  });

  it("serializes accepted actor IDs as strings", () => {
    const parsed = businessModuleRegistryResponseSchema.parse({
      registryHash: hash,
      acceptedRegistryHash: hash,
      modules: [
        {
          moduleCode: "regional-ops",
          defaultLocale: "en",
          title: { key: "modules.regional-ops.title", defaultMessage: "Regional operations" },
          description: null,
          definitionHash: hash,
          activationHash: hash,
          acceptedDefinitionHash: hash,
          acceptedActivationHash: hash,
          state: "active",
          drift: "none",
          contributionCounts: {
            permissions: 0,
            apis: 0,
            routes: 0,
            menus: 0,
            dataResources: 0,
            fields: 0,
            operationEvents: 0,
            importExportResources: 0,
            fileAttachments: 0,
            domainEvents: 0,
            notificationEvents: 0,
            i18nMessages: 0,
            dictionaryDependencies: 0,
            scheduledJobs: 0,
            errors: 0,
          },
          dependencyFailures: [],
          acceptedAt: "2026-07-20T00:00:00.000Z",
          acceptedBy: "42",
        },
      ],
    });

    expect(parsed.modules[0]?.acceptedBy).toBe("42");
    expect(
      businessModuleRegistryResponseSchema.safeParse({
        ...parsed,
        modules: [{ ...parsed.modules[0], acceptedBy: 42 }],
      }).success,
    ).toBe(false);
  });

  it("uses a nullable override to restore the manifest default", () => {
    expect(updateI18nMessageRequestSchema.parse({ overrideValue: null })).toEqual({
      overrideValue: null,
    });
    expect(updateI18nMessageRequestSchema.parse({ overrideValue: "Administrator text" })).toEqual({
      overrideValue: "Administrator text",
    });
  });
});
