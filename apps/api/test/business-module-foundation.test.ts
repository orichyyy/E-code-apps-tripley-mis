import { hc } from "hono/client";
import { describe, expect, it } from "vitest";

import {
  baseApiPermissionManifest,
  baseMenuManifest,
  businessModuleDefinitions,
  createOpenApiDocument,
} from "@web-admin-base/contracts";
import { businessModuleMigrationRegistry } from "@web-admin-base/db";

import { createApp } from "../src/app";
import { businessApiModuleRegistry } from "../src/business-modules/registry";
import { createSyntheticBusinessRouter } from "./fixtures/synthetic-business-router";

describe("Business Module composition foundation", () => {
  it("preserves Hono RPC inference for an explicitly composed fixture router", () => {
    const fixtureApp = createSyntheticBusinessRouter();
    const client = hc<typeof fixtureApp>("/");

    expect(fixtureApp).toBeDefined();
    expect(client.api.modules["fixture-orders"].orders.$get).toBeDefined();
  });

  it("keeps synthetic fixtures out of every production catalog and route surface", () => {
    const serializedProductionSurface = JSON.stringify({
      businessModuleDefinitions,
      businessApiModuleRegistry,
      businessModuleMigrationRegistry,
      baseApiPermissionManifest,
      baseMenuManifest,
      openapi: createOpenApiDocument(),
      mountedRoutes: createApp().routes.map(({ method, path }) => ({ method, path })),
    });

    expect(businessModuleDefinitions).toEqual([]);
    expect(businessApiModuleRegistry).toEqual([]);
    expect(businessModuleMigrationRegistry).toEqual([]);
    expect(serializedProductionSurface).not.toContain("fixture-orders");
  });
});
