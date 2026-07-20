import { describe, expect, it } from "vitest";

import { assertBusinessModuleConformance, checkBusinessModuleConformance } from "../src";
import { createValidFixtureModule, fixtureModuleCode } from "./fixtures/valid-business-module";

const matchingRuntime = {
  apiModules: [
    {
      moduleCode: fixtureModuleCode,
      routes: [
        {
          code: "api.fixture-orders.list",
          method: "GET" as const,
          path: "/api/modules/fixture-orders/orders",
        },
      ],
    },
  ],
  webModules: [
    {
      moduleCode: fixtureModuleCode,
      routes: [
        {
          routeCode: "fixture-orders.orders",
          path: "/modules/fixture-orders/orders",
        },
      ],
    },
  ],
  workerModules: [{ moduleCode: fixtureModuleCode, jobTypes: [], importExportResourceTypes: [] }],
  databaseModuleCodes: [],
  mountedApiRoutes: [{ method: "GET" as const, path: "/api/modules/fixture-orders/orders" }],
  tanstackRoutePaths: ["/modules/fixture-orders/orders"],
};

describe("Business Module conformance", () => {
  it("accepts a definition whose runtime registrations match", () => {
    const report = checkBusinessModuleConformance({
      definitions: [createValidFixtureModule()],
      runtime: matchingRuntime,
    });

    expect(report.ok).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(() =>
      assertBusinessModuleConformance({
        definitions: [createValidFixtureModule()],
        runtime: matchingRuntime,
      }),
    ).not.toThrow();
  });

  it("reports namespace, cross-reference, and runtime mismatches", () => {
    const definition = createValidFixtureModule();
    definition.contributions.permissions[0]!.code = "other.order:view";

    const report = checkBusinessModuleConformance({
      definitions: [definition],
      runtime: {
        ...matchingRuntime,
        mountedApiRoutes: [],
        tanstackRoutePaths: [],
      },
    });

    expect(report.ok).toBe(false);
    expect(report.diagnostics.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "MODULE_NAMESPACE_VIOLATION",
        "MODULE_REFERENCE_NOT_FOUND",
        "MODULE_API_ROUTE_NOT_MOUNTED",
        "MODULE_WEB_ROUTE_NOT_MOUNTED",
      ]),
    );
    expect(() =>
      assertBusinessModuleConformance({ definitions: [definition], runtime: matchingRuntime }),
    ).toThrow(/MODULE_NAMESPACE_VIOLATION/);
  });

  it("rejects duplicate ownership across modules", () => {
    const first = createValidFixtureModule();
    const second = { ...createValidFixtureModule(), moduleCode: "second-module" };

    const report = checkBusinessModuleConformance({
      definitions: [first, second],
      runtime: matchingRuntime,
    });

    expect(report.diagnostics.map(({ code }) => code)).toContain("MODULE_DUPLICATE_OWNERSHIP");
  });
});
