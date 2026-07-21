import { describe, expect, it } from "vitest";
import { z } from "zod";

import { assertBusinessModuleConformance, checkBusinessModuleConformance } from "../src";
import { createValidFixtureModule, fixtureModuleCode } from "./fixtures/valid-business-module";
import { capabilityApiRegistration, capabilityModule } from "./fixtures/capability-business-module";

const matchingRuntime = {
  apiModules: [
    {
      moduleCode: fixtureModuleCode,
      schemas: {
        FixtureOrderListRequest: z.object({}),
        FixtureOrderList: z.object({}),
      },
      dataPermissionOperators: {},
      fileAttachmentAuthorizers: {},
      importExportResources: {},
      notificationRecipientResolvers: {},
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
  workerModules: [
    { moduleCode: fixtureModuleCode, schemas: {}, jobHandlers: {}, importExportHandlers: {} },
  ],
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
    definition.contributions.permissions.find(
      ({ code }) => code === "fixture-orders.order:view",
    )!.code = "other.order:view";

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

  it("rejects invalid resource permission and field references", () => {
    const definition = createValidFixtureModule();
    definition.contributions.dataResources[0]!.permissionCode = "fixture-orders.order:view";
    definition.contributions.fields[0]!.field = "missingField";

    const report = checkBusinessModuleConformance({
      definitions: [definition],
      runtime: matchingRuntime,
    });

    expect(report.diagnostics.map(({ code }) => code)).toEqual(
      expect.arrayContaining(["MODULE_DATA_PERMISSION_INVALID", "MODULE_RESOURCE_FIELD_NOT_FOUND"]),
    );
  });

  it("requires declared custom data operators to be registered by the API runtime", () => {
    const definition = createValidFixtureModule();
    definition.contributions.dataResources[0]!.operatorCodes = ["fixture-orders.region-access"];

    const missing = checkBusinessModuleConformance({
      definitions: [definition],
      runtime: matchingRuntime,
    });
    const registered = checkBusinessModuleConformance({
      definitions: [definition],
      runtime: {
        ...matchingRuntime,
        apiModules: [
          {
            ...matchingRuntime.apiModules[0]!,
            dataPermissionOperators: {
              "fixture-orders.region-access": () => ({ type: "true" }),
            },
          },
        ],
      },
    });

    expect(missing.diagnostics.map(({ code }) => code)).toContain(
      "MODULE_API_OPERATOR_REGISTRATION_MISMATCH",
    );
    expect(registered.ok).toBe(true);
  });

  it("requires executable capability schemas, authorizers, resolvers, and Worker handlers", () => {
    const missing = checkBusinessModuleConformance({
      definitions: [capabilityModule],
      runtime: {
        apiModules: [],
        webModules: [],
        workerModules: [],
        databaseModuleCodes: [],
        mountedApiRoutes: [],
        tanstackRoutePaths: [],
      },
    });
    const valid = checkBusinessModuleConformance({
      definitions: [capabilityModule],
      runtime: {
        apiModules: [capabilityApiRegistration],
        webModules: [],
        workerModules: [
          {
            moduleCode: capabilityModule.moduleCode,
            schemas: { ReconcileInput: z.object({ batchSize: z.number() }) },
            jobHandlers: { "fixture-capabilities.reconcile": async () => undefined },
            importExportHandlers: {
              "fixture-capabilities:records": {
                export: async () => ({ rows: [] }),
                import: async () => ({ totalRows: 0, successRows: 0, errors: [] }),
              },
            },
          },
        ],
        databaseModuleCodes: [],
        mountedApiRoutes: [],
        tanstackRoutePaths: [],
      },
    });

    expect(missing.diagnostics.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "MODULE_API_REGISTRATION_MISMATCH",
        "MODULE_WORKER_REGISTRATION_MISMATCH",
      ]),
    );
    expect(valid.ok).toBe(true);
  });
});
