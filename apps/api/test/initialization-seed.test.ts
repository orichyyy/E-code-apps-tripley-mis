import { describe, expect, it } from "vitest";

import {
  readInitializationSeedInput,
  runInitializationSeed
} from "../src/seed";
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
});
