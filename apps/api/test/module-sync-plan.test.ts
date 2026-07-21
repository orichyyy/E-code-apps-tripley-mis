import { createBusinessModuleRegistry } from "@web-admin-base/module-sdk";
import { describe, expect, it } from "vitest";

import {
  buildModuleSyncPlan,
  describeBusinessModuleRegistry,
} from "../src/modules/module-lifecycle/module-sync-plan";
import type { AcceptedModuleRegistrySnapshot } from "../src/modules/module-lifecycle/module-lifecycle.types";
import { createLifecycleFixtureModule } from "./fixtures/business-module-definition";

const emptyAccepted: AcceptedModuleRegistrySnapshot = {
  registryHash: null,
  acceptedAt: null,
  entries: [],
};

describe("Module Sync Plan", () => {
  it("keeps a new module pending until it is accepted", () => {
    const registry = createBusinessModuleRegistry([createLifecycleFixtureModule()]);
    const plan = buildModuleSyncPlan(registry, emptyAccepted, new Set(), []);
    const catalog = describeBusinessModuleRegistry(registry, emptyAccepted, []);

    expect(plan.changes).toEqual([
      expect.objectContaining({ type: "add", moduleCode: "fixture-lifecycle", drift: "new" }),
    ]);
    expect(catalog.modules[0]).toMatchObject({ state: "pending", drift: "new" });
  });

  it("keeps presentation-only drift active but requires sync to accept the new definition", () => {
    const acceptedRegistry = createBusinessModuleRegistry([createLifecycleFixtureModule()]);
    const releaseRegistry = createBusinessModuleRegistry([
      createLifecycleFixtureModule({ title: "Updated fixture title" }),
    ]);
    const accepted = snapshotFromRegistry(acceptedRegistry);

    const plan = buildModuleSyncPlan(releaseRegistry, accepted, new Set(), []);
    const catalog = describeBusinessModuleRegistry(releaseRegistry, accepted, []);

    expect(plan.changes[0]).toMatchObject({ type: "update", drift: "presentation" });
    expect(catalog.modules[0]).toMatchObject({ state: "active", drift: "presentation" });
  });

  it("fails closed when activation metadata changes", () => {
    const acceptedRegistry = createBusinessModuleRegistry([createLifecycleFixtureModule()]);
    const releaseRegistry = createBusinessModuleRegistry([
      createLifecycleFixtureModule({ requiredPermission: "fixture-lifecycle.record:list" }),
    ]);
    const catalog = describeBusinessModuleRegistry(
      releaseRegistry,
      snapshotFromRegistry(acceptedRegistry),
      [],
    );

    expect(catalog.modules[0]).toMatchObject({ state: "pending", drift: "activation" });
  });

  it("plans removal without losing the accepted module record", () => {
    const acceptedRegistry = createBusinessModuleRegistry([createLifecycleFixtureModule()]);
    const plan = buildModuleSyncPlan(
      createBusinessModuleRegistry([]),
      snapshotFromRegistry(acceptedRegistry),
      new Set(),
      [
        {
          permissionCode: "fixture-lifecycle.record:view",
          roleBindingCount: 2,
          dataRuleCount: 1,
          userOverrideCount: 1,
        },
      ],
    );

    expect(plan.changes).toEqual([
      {
        type: "disable",
        moduleCode: "fixture-lifecycle",
        drift: "removed",
        authorizationBindingsRemoved: [
          expect.objectContaining({ permissionCode: "fixture-lifecycle.record:view" }),
        ],
      },
    ]);
  });

  it("blocks apply when an enabled global dictionary dependency is unavailable", () => {
    const registry = createBusinessModuleRegistry([
      createLifecycleFixtureModule({ dictionaryDependency: "region" }),
    ]);
    const plan = buildModuleSyncPlan(registry, emptyAccepted, new Set(), []);

    expect(plan.canApply).toBe(false);
    expect(plan.dependencyFailures).toEqual([
      {
        moduleCode: "fixture-lifecycle",
        dictionaryTypeCode: "region",
        reason: "missing_or_disabled",
      },
    ]);
  });
});

function snapshotFromRegistry(
  registry: ReturnType<typeof createBusinessModuleRegistry>,
): AcceptedModuleRegistrySnapshot {
  return {
    registryHash: registry.registryHash,
    acceptedAt: "2026-07-20T00:00:00.000Z",
    entries: registry.modules.map((entry) => ({
      ...entry,
      status: "active" as const,
      acceptedAt: "2026-07-20T00:00:00.000Z",
      acceptedBy: "1",
      disabledAt: null,
    })),
  };
}
