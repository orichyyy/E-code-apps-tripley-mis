import { createBusinessModuleRegistry } from "@web-admin-base/module-sdk";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app";
import { createBusinessModuleActivationMiddleware } from "../src/middleware/business-module-activation";
import { createInMemoryBackendCoreServices } from "../src/modules/core-foundation/services";
import { InMemoryModuleLifecycleStore } from "../src/modules/module-lifecycle/in-memory-module-lifecycle.store";
import { ModuleLifecycleService } from "../src/modules/module-lifecycle/module-lifecycle.service";
import { createLifecycleFixtureModule } from "./fixtures/business-module-definition";

const setupInput = {
  organizationName: "Default Organization",
  organizationCode: "default",
  adminUsername: "admin",
  adminDisplayName: "Administrator",
  adminEmail: "admin@example.com",
  adminPhone: "10000000000",
  adminPassword: "admin1234",
};

describe("Business Module lifecycle APIs", () => {
  it("exposes accepted registry, plan, and confirmed idempotent apply", async () => {
    const app = createApp();
    await app.request("/api/initialization/setup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(setupInput),
    });
    const token = await login(app);

    const registryResponse = await app.request("/api/modules/registry", {
      headers: { authorization: `Bearer ${token}` },
    });
    const registryBody = await registryResponse.json();
    expect(registryResponse.status).toBe(200);
    expect(registryBody.data).toMatchObject({ modules: [] });
    expect(registryBody.data.acceptedRegistryHash).toBe(registryBody.data.registryHash);

    const planResponse = await app.request("/api/modules/sync/plan", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(await planResponse.json()).toMatchObject({
      data: { changes: [], canApply: true },
    });

    const applyResponse = await app.request("/api/modules/sync/apply", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        expectedRegistryHash: registryBody.data.registryHash,
        confirmed: true,
      }),
    });
    expect(await applyResponse.json()).toMatchObject({ data: { applied: false, modules: [] } });
  });

  it("rejects stale apply requests with a stable error code", async () => {
    const backendCoreServices = createInMemoryBackendCoreServices();
    await backendCoreServices.initialize(setupInput);
    const app = createApp({ backendCoreServices });
    const token = (
      await backendCoreServices.login(
        { username: setupInput.adminUsername, password: setupInput.adminPassword },
        {},
      )
    ).accessToken;
    const response = await app.request("/api/modules/sync/apply", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ expectedRegistryHash: "f".repeat(64), confirmed: true }),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: { code: "BUSINESS_MODULE_REGISTRY_STALE" },
    });
  });

  it("rejects first-start initialization before core state changes when dependencies fail", async () => {
    const backendCoreServices = createInMemoryBackendCoreServices();
    const registry = createBusinessModuleRegistry([
      createLifecycleFixtureModule({ dictionaryDependency: "missing_dictionary" }),
    ]);
    const app = createApp({
      backendCoreServices,
      moduleLifecycleService: new ModuleLifecycleService(
        registry,
        new InMemoryModuleLifecycleStore(),
      ),
    });

    const response = await app.request("/api/initialization/setup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(setupInput),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: { code: "BUSINESS_MODULE_DEPENDENCY_UNSATISFIED" },
    });
    expect(backendCoreServices.getInitializationStatus()).toEqual({
      initialized: false,
      state: null,
    });
  });
});

describe("Business Module activation gate", () => {
  it("fails before downstream authorization until activation is accepted", async () => {
    const registry = createBusinessModuleRegistry([createLifecycleFixtureModule()]);
    const service = new ModuleLifecycleService(registry, new InMemoryModuleLifecycleStore());
    const authorization = vi.fn();
    const app = new Hono();
    app.use("*", createBusinessModuleActivationMiddleware(service));
    app.use("*", async (_context, next) => {
      authorization();
      await next();
    });
    app.get("/api/modules/fixture-lifecycle/records", (context) => context.json({ data: [] }));
    app.onError((error, context) =>
      context.json({ error: { code: "code" in error ? error.code : "unknown" } }, 503),
    );

    const pending = await app.request("/api/modules/fixture-lifecycle/records");
    expect(await pending.json()).toEqual({ error: { code: "MODULE_NOT_SYNCHRONIZED" } });
    expect(authorization).not.toHaveBeenCalled();

    await service.bootstrap(null);
    const active = await app.request("/api/modules/fixture-lifecycle/records");
    expect(active.status).toBe(200);
    expect(authorization).toHaveBeenCalledOnce();
  });
});

async function login(app: ReturnType<typeof createApp>): Promise<string> {
  const response = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: setupInput.adminUsername,
      password: setupInput.adminPassword,
    }),
  });
  const body = await response.json();
  return body.data.accessToken as string;
}
