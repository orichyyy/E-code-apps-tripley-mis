import { describe, expect, it } from "vitest";

import {
  readInitializationSeedInput,
  runInitializationSeed
} from "../src/seed";
import { createApp } from "../src/app";
import { createInMemoryBackendCoreServices } from "../src/modules/core-foundation/services";

const seedEnv = {
  WEB_ADMIN_SEED_ORGANIZATION_NAME: "Seed Organization",
  WEB_ADMIN_SEED_ORGANIZATION_CODE: "seed",
  WEB_ADMIN_SEED_ADMIN_USERNAME: "seed-admin",
  WEB_ADMIN_SEED_ADMIN_DISPLAY_NAME: "Seed Admin",
  WEB_ADMIN_SEED_ADMIN_EMAIL: "seed-admin@example.com",
  WEB_ADMIN_SEED_ADMIN_PHONE: "10000000999",
  WEB_ADMIN_SEED_ADMIN_PASSWORD: "password1"
};

describe("initialization seed", () => {
  it("requires the seed admin password to come from the environment", () => {
    expect(() => readInitializationSeedInput({})).toThrow(
      "WEB_ADMIN_SEED_ADMIN_PASSWORD is required"
    );
  });

  it("runs seed initialization from environment input", async () => {
    const summary = await runInitializationSeed(seedEnv);

    expect(summary).toMatchObject({
      initialized: true,
      seeded: true,
      organizationId: "1",
      adminId: "1"
    });
    expect(summary.roleCount).toBe(3);
    expect(summary.permissionCount).toBeGreaterThan(0);
    expect(summary.menuCount).toBeGreaterThan(0);
  });

  it("keeps repeated seed runs idempotent on an initialized service", async () => {
    const services = createInMemoryBackendCoreServices();
    const input = readInitializationSeedInput(seedEnv);

    const first = await services.seedInitialization(input);
    const second = await services.seedInitialization(input);
    const superAdminPermissions = services.listRolePermissionCodes("1");

    expect(first.seeded).toBe(true);
    expect(second.seeded).toBe(false);
    expect(second.roles).toHaveLength(3);
    expect(new Set(superAdminPermissions).size).toBe(superAdminPermissions.length);
  });

  it("restores existing built-in roles during repeated seed sync", async () => {
    const services = createInMemoryBackendCoreServices();
    const input = readInitializationSeedInput(seedEnv);

    await services.seedInitialization(input);
    await services.setRoleStatus("1", "disabled");
    const result = await services.seedInitialization(input);
    const superAdmin = services.getRole("1");

    expect(result.seeded).toBe(false);
    expect(superAdmin).toMatchObject({
      code: "super_admin",
      description: "Built-in role",
      isBuiltin: true,
      status: "enabled"
    });
  });

  it("restores soft-deleted built-in roles during repeated seed sync", async () => {
    const services = createInMemoryBackendCoreServices();
    const input = readInitializationSeedInput(seedEnv);

    await services.seedInitialization(input);
    await services.deleteRole("1");
    const result = await services.seedInitialization(input);
    const superAdmin = services.getRole("1");

    expect(result.seeded).toBe(false);
    expect(superAdmin).toMatchObject({
      id: "1",
      code: "super_admin",
      isBuiltin: true,
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
      status: "enabled"
    });
  });

  it("restores the initialized administrator super-admin binding during repeated seed sync", async () => {
    const services = createInMemoryBackendCoreServices();
    const app = createApp({ backendCoreServices: services });
    const input = readInitializationSeedInput(seedEnv);

    await services.seedInitialization(input);
    await services.deleteRole("1", "1");
    const result = await services.seedInitialization(input);
    const bindings = services.listUserOrganizationRoles("1");
    const loginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "seed-admin", password: "password1" })
    });
    const login = await loginResponse.json();

    expect(result.seeded).toBe(false);
    expect(bindings).toEqual([
      expect.objectContaining({
        userId: "1",
        organizationId: "1",
        roleId: "1",
        isPrimary: true,
        status: "enabled",
        isDeleted: false,
        deletedAt: null,
        deletedBy: null
      })
    ]);
    expect(loginResponse.status).toBe(200);
    expect(login.data.permissionCodes).toEqual(expect.arrayContaining(["user:view"]));
  });

  it("restores soft-deleted base menus during repeated seed sync", async () => {
    const services = createInMemoryBackendCoreServices();
    const input = readInitializationSeedInput(seedEnv);

    await services.seedInitialization(input);
    const menu = services.listMenus().find((candidate) => candidate.code === "system.users");
    if (!menu) throw new Error("Expected system.users base menu to exist");
    await services.deleteMenu(menu.id);
    const result = await services.seedInitialization(input);
    const restoredMenu = services.listMenus().find((candidate) => candidate.code === "system.users");

    expect(result.seeded).toBe(false);
    expect(restoredMenu).toMatchObject({
      id: menu.id,
      code: "system.users",
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
      status: "enabled",
      visible: true
    });
  });

  it("restores disabled route metadata during repeated seed sync", async () => {
    const services = createInMemoryBackendCoreServices();
    const input = readInitializationSeedInput(seedEnv);

    await services.seedInitialization(input);
    const route = services.listRoutes().find((candidate) => candidate.routeCode === "system.users");
    if (!route) throw new Error("Expected system.users base route to exist");
    route.status = "disabled";
    const result = await services.seedInitialization(input);
    const restoredRoute = services
      .listRoutes()
      .find((candidate) => candidate.routeCode === "system.users");

    expect(result.seeded).toBe(false);
    expect(restoredRoute).toMatchObject({
      id: route.id,
      routeCode: "system.users",
      status: "enabled"
    });
  });

  it("restores disabled API permission metadata during repeated seed sync", async () => {
    const services = createInMemoryBackendCoreServices();
    const input = readInitializationSeedInput(seedEnv);

    await services.seedInitialization(input);
    const apiPermission = services
      .listApiPermissions()
      .find((candidate) => candidate.code === "api.users.list");
    if (!apiPermission) throw new Error("Expected api.users.list base API permission to exist");
    apiPermission.status = "disabled";
    const result = await services.seedInitialization(input);
    const restoredApiPermission = services
      .listApiPermissions()
      .find((candidate) => candidate.code === "api.users.list");

    expect(result.seeded).toBe(false);
    expect(restoredApiPermission).toMatchObject({
      id: apiPermission.id,
      code: "api.users.list",
      status: "enabled"
    });
  });

  it("invalidates cached permission contexts during repeated seed sync", async () => {
    const services = createInMemoryBackendCoreServices();
    const app = createApp({ backendCoreServices: services });
    const input = readInitializationSeedInput(seedEnv);

    await services.seedInitialization(input);
    const permission = services
      .listPermissions()
      .find((candidate) => candidate.code === "user:view");
    if (!permission) throw new Error("Expected user:view base permission to exist");
    permission.status = "disabled";
    const loginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "seed-admin", password: "password1" })
    });
    const login = await loginResponse.json();
    const authHeaders = { authorization: `Bearer ${login.data.accessToken}` };

    const staleResponse = await app.request("/api/context/permissions", { headers: authHeaders });
    const stale = await staleResponse.json();
    await services.seedInitialization(input);
    const refreshedResponse = await app.request("/api/context/permissions", {
      headers: authHeaders
    });
    const refreshed = await refreshedResponse.json();

    expect(stale.data.permissionCodes).not.toEqual(expect.arrayContaining(["user:view"]));
    expect(refreshed.data.permissionCodes).toEqual(expect.arrayContaining(["user:view"]));
  });
});
