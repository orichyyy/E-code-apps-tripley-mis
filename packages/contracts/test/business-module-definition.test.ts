import { describe, expect, it } from "vitest";

import {
  baseApiPermissionManifest,
  baseMenuManifest,
  basePermissionManifest,
  baseRouteManifest,
} from "../src";
import {
  baseSystemCompatibilityDefinition,
  businessModuleDefinitionSchema,
  normalizeBusinessModuleDefinition,
} from "../src/business-modules";

describe("Business Module Definition contract", () => {
  it("wraps Base System manifests without changing their identifiers", () => {
    expect(baseSystemCompatibilityDefinition.permissions).toBe(basePermissionManifest);
    expect(baseSystemCompatibilityDefinition.apiPermissions).toBe(baseApiPermissionManifest);
    expect(baseSystemCompatibilityDefinition.routes).toBe(baseRouteManifest);
    expect(baseSystemCompatibilityDefinition.menus).toBe(baseMenuManifest);
  });

  it("normalizes omitted contribution collections to empty arrays", () => {
    const definition = normalizeBusinessModuleDefinition({
      contractVersion: 1,
      moduleCode: "regional-ops",
      defaultLocale: "zh-CN",
      title: {
        key: "modules.regional-ops.title",
        defaultMessage: "Regional operations",
      },
    });

    expect(definition).toMatchObject({
      contractVersion: 1,
      moduleCode: "regional-ops",
      defaultLocale: "zh-CN",
      title: {
        key: "modules.regional-ops.title",
        defaultMessage: "Regional operations",
      },
    });
    expect(Object.values(definition.contributions).every(Array.isArray)).toBe(true);
  });

  it("rejects malformed locales, literal-only titles, and unknown fields", () => {
    const base = {
      contractVersion: 1 as const,
      moduleCode: "regional-ops",
      title: {
        key: "modules.regional-ops.title",
        defaultMessage: "Regional operations",
      },
    };

    expect(
      businessModuleDefinitionSchema.safeParse({ ...base, defaultLocale: "not_a_locale" }).success,
    ).toBe(false);
    expect(
      businessModuleDefinitionSchema.safeParse({
        ...base,
        defaultLocale: "en",
        title: "Regional operations",
      }).success,
    ).toBe(false);
    expect(
      businessModuleDefinitionSchema.safeParse({
        ...base,
        defaultLocale: "en",
        discoveredAtRuntime: true,
      }).success,
    ).toBe(false);
  });

  it("requires explicit API schemas and canonical translation locales", () => {
    const definition = {
      contractVersion: 1 as const,
      moduleCode: "regional-ops",
      defaultLocale: "en",
      title: {
        key: "modules.regional-ops.title",
        defaultMessage: "Regional operations",
      },
    };

    expect(
      businessModuleDefinitionSchema.safeParse({
        ...definition,
        contributions: {
          apis: [
            {
              code: "api.regional-ops.list",
              method: "GET",
              path: "/api/modules/regional-ops/items",
              description: {
                key: "modules.regional-ops.apis.list",
                defaultMessage: "List items",
              },
              requiredPermission: "regional-ops.item:view",
              logLevel: "basic",
              responseSchemaId: "ItemListResponse",
            },
          ],
        },
      }).success,
    ).toBe(false);
    expect(
      businessModuleDefinitionSchema.safeParse({
        ...definition,
        contributions: {
          i18nMessages: [
            {
              key: "modules.regional-ops.status.active",
              defaultMessage: "Active",
              translations: { en_us: "Active" },
            },
          ],
        },
      }).success,
    ).toBe(false);
  });
});
