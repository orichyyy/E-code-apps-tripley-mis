import { createBusinessModuleRegistry } from "@web-admin-base/module-sdk";
import { describe, expect, it, vi } from "vitest";

import { InMemoryModuleLifecycleStore } from "../src/modules/module-lifecycle/in-memory-module-lifecycle.store";
import { ModuleLifecycleService } from "../src/modules/module-lifecycle/module-lifecycle.service";
import { createInMemoryBackendCoreServices } from "../src/modules/core-foundation/services";
import { createLifecycleFixtureModule } from "./fixtures/business-module-definition";

const acceptedAt = "2026-07-20T01:02:03.000Z";

describe("Business Module lifecycle service", () => {
  it("activates a pending module only after confirmed apply", async () => {
    const registry = createBusinessModuleRegistry([createLifecycleFixtureModule()]);
    const store = new InMemoryModuleLifecycleStore();
    const afterApply = vi.fn<() => Promise<void>>().mockResolvedValue();
    const service = new ModuleLifecycleService(registry, store, { afterApply }, () => acceptedAt);

    expect(await service.isModuleActive("fixture-lifecycle")).toBe(false);
    const result = await service.apply(
      { expectedRegistryHash: registry.registryHash, confirmed: true },
      "7",
    );

    expect(result).toMatchObject({ applied: true, acceptedAt });
    expect(await service.isModuleActive("fixture-lifecycle")).toBe(true);
    expect(afterApply).toHaveBeenCalledOnce();
  });

  it("rejects a stale release registry hash", async () => {
    const registry = createBusinessModuleRegistry([createLifecycleFixtureModule()]);
    const service = new ModuleLifecycleService(registry, new InMemoryModuleLifecycleStore());

    await expect(
      service.apply({ expectedRegistryHash: "f".repeat(64), confirmed: true }, "7"),
    ).rejects.toMatchObject({ code: "BUSINESS_MODULE_REGISTRY_STALE" });
  });

  it("does not apply a registry with unresolved dictionary dependencies", async () => {
    const registry = createBusinessModuleRegistry([
      createLifecycleFixtureModule({ dictionaryDependency: "region" }),
    ]);
    const service = new ModuleLifecycleService(registry, new InMemoryModuleLifecycleStore());

    await expect(
      service.apply({ expectedRegistryHash: registry.registryHash, confirmed: true }, "7"),
    ).rejects.toMatchObject({ code: "BUSINESS_MODULE_DEPENDENCY_UNSATISFIED" });
  });

  it("is idempotent for an already accepted registry", async () => {
    const registry = createBusinessModuleRegistry([createLifecycleFixtureModule()]);
    const store = new InMemoryModuleLifecycleStore();
    const afterApply = vi.fn<() => Promise<void>>().mockResolvedValue();
    const service = new ModuleLifecycleService(registry, store, { afterApply }, () => acceptedAt);

    await service.bootstrap("7");
    const result = await service.apply(
      { expectedRegistryHash: registry.registryHash, confirmed: true },
      "7",
    );

    expect(result.applied).toBe(false);
    expect(result.acceptedAt).toBe(acceptedAt);
    expect(afterApply).toHaveBeenCalledTimes(2);
  });

  it("refreshes active menus and invalidates cached permission contexts after Apply", async () => {
    const backend = createInMemoryBackendCoreServices();
    await backend.initialize({
      organizationName: "Default Organization",
      organizationCode: "default",
      adminUsername: "admin",
      adminDisplayName: "Administrator",
      adminEmail: "admin@example.com",
      adminPhone: "10000000000",
      adminPassword: "admin1234",
    });
    const login = await backend.login({ username: "admin", password: "admin1234" }, {});
    const authContext = backend.findAuthContext(`Bearer ${login.accessToken}`);
    if (!authContext) throw new Error("Expected an authenticated test context.");
    expect((await backend.getCurrentPermissionContext(authContext)).permissionCodes).not.toContain(
      "fixture-lifecycle.record:view",
    );

    const store = new InMemoryModuleLifecycleStore();
    const registry = createBusinessModuleRegistry([createLifecycleFixtureModule()]);
    const service = new ModuleLifecycleService(registry, store, {
      afterApply: (definitions) => backend.refreshBusinessModuleMetadata(definitions),
    });
    await service.apply({ expectedRegistryHash: registry.registryHash, confirmed: true }, "1");

    expect((await backend.getCurrentPermissionContext(authContext)).permissionCodes).toContain(
      "fixture-lifecycle.record:view",
    );
    expect(backend.listMenus()).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "fixture-lifecycle.records" })]),
    );

    const emptyRegistry = createBusinessModuleRegistry([]);
    await new ModuleLifecycleService(emptyRegistry, store, {
      afterApply: (definitions) => backend.refreshBusinessModuleMetadata(definitions),
    }).apply({ expectedRegistryHash: emptyRegistry.registryHash, confirmed: true }, "1");
    expect((await backend.getCurrentPermissionContext(authContext)).permissionCodes).not.toContain(
      "fixture-lifecycle.record:view",
    );
    expect(backend.listMenus()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "fixture-lifecycle.records", status: "disabled" }),
      ]),
    );
    expect(
      (await backend.getCurrentUserContext(authContext)).menus.some(
        (menu) => menu.code === "fixture-lifecycle.records",
      ),
    ).toBe(false);
  });
});
