import type {
  BusinessModuleContributionCounts,
  BusinessModuleRegistryItem,
  BusinessModuleRegistryResponse,
  ModuleAuthorizationBindingRemoval,
  ModuleDependencyFailure,
  ModuleSyncPlanChange,
  ModuleSyncPlanResponse,
} from "@web-admin-base/contracts";
import type { BusinessModuleRegistry } from "@web-admin-base/module-sdk";

import type {
  AcceptedModuleRegistryEntry,
  AcceptedModuleRegistrySnapshot,
  AuthorizationBindingCounts,
} from "./module-lifecycle.types";

export function buildModuleSyncPlan(
  registry: BusinessModuleRegistry,
  accepted: AcceptedModuleRegistrySnapshot,
  enabledDictionaryTypeCodes: Set<string>,
  bindingCounts: AuthorizationBindingCounts[],
): ModuleSyncPlanResponse {
  const dependencyFailures = findDependencyFailures(registry, enabledDictionaryTypeCodes);
  const changes = findChanges(registry, accepted, bindingCounts);

  return {
    registryHash: registry.registryHash,
    acceptedRegistryHash: accepted.registryHash,
    changes,
    dependencyFailures,
    canApply: dependencyFailures.length === 0,
  };
}

export function describeBusinessModuleRegistry(
  registry: BusinessModuleRegistry,
  accepted: AcceptedModuleRegistrySnapshot,
  dependencyFailures: ModuleDependencyFailure[],
): BusinessModuleRegistryResponse {
  const releaseByCode = new Map(
    registry.modules.map((entry) => [entry.definition.moduleCode, entry]),
  );
  const acceptedByCode = new Map(
    accepted.entries.map((entry) => [entry.definition.moduleCode, entry]),
  );
  const moduleCodes = [...new Set([...releaseByCode.keys(), ...acceptedByCode.keys()])].sort();

  return {
    registryHash: registry.registryHash,
    acceptedRegistryHash: accepted.registryHash,
    modules: moduleCodes.map((moduleCode) =>
      describeModule(
        releaseByCode.get(moduleCode),
        acceptedByCode.get(moduleCode),
        dependencyFailures.filter((failure) => failure.moduleCode === moduleCode),
      ),
    ),
  };
}

export function findDependencyFailures(
  registry: BusinessModuleRegistry,
  enabledDictionaryTypeCodes: Set<string>,
): ModuleDependencyFailure[] {
  return registry.modules.flatMap(({ definition }) =>
    definition.contributions.dictionaryDependencies
      .filter((dependency) => !enabledDictionaryTypeCodes.has(dependency.code))
      .map((dependency) => ({
        moduleCode: definition.moduleCode,
        dictionaryTypeCode: dependency.code,
        reason: "missing_or_disabled" as const,
      })),
  );
}

function findChanges(
  registry: BusinessModuleRegistry,
  accepted: AcceptedModuleRegistrySnapshot,
  bindingCounts: AuthorizationBindingCounts[],
): ModuleSyncPlanChange[] {
  const releaseByCode = new Map(
    registry.modules.map((entry) => [entry.definition.moduleCode, entry]),
  );
  const acceptedByCode = new Map(
    accepted.entries.map((entry) => [entry.definition.moduleCode, entry]),
  );
  const changes: ModuleSyncPlanChange[] = [];

  for (const release of registry.modules) {
    const previous = acceptedByCode.get(release.definition.moduleCode);
    if (!previous || previous.status === "disabled") {
      changes.push({
        type: "add",
        moduleCode: release.definition.moduleCode,
        drift: previous ? "reintroduced" : "new",
        authorizationBindingsRemoved: [],
      });
      continue;
    }
    if (previous.definitionHash !== release.definitionHash) {
      changes.push({
        type: "update",
        moduleCode: release.definition.moduleCode,
        drift: previous.activationHash === release.activationHash ? "presentation" : "activation",
        authorizationBindingsRemoved: removedBindings(previous, release.definition, bindingCounts),
      });
    }
  }

  for (const previous of accepted.entries) {
    if (previous.status !== "active" || releaseByCode.has(previous.definition.moduleCode)) continue;
    changes.push({
      type: "disable",
      moduleCode: previous.definition.moduleCode,
      drift: "removed",
      authorizationBindingsRemoved: removedBindings(previous, null, bindingCounts),
    });
  }

  return changes.sort((left, right) => left.moduleCode.localeCompare(right.moduleCode));
}

function describeModule(
  release: BusinessModuleRegistry["modules"][number] | undefined,
  accepted: AcceptedModuleRegistryEntry | undefined,
  dependencyFailures: ModuleDependencyFailure[],
): BusinessModuleRegistryItem {
  const definition = release?.definition ?? accepted?.definition;
  if (!definition) throw new Error("Business Module catalog entry has no definition.");
  const drift = moduleDrift(release, accepted);

  return {
    moduleCode: definition.moduleCode,
    defaultLocale: definition.defaultLocale,
    title: definition.title,
    description: definition.description ?? null,
    definitionHash: release?.definitionHash ?? null,
    activationHash: release?.activationHash ?? null,
    acceptedDefinitionHash: accepted?.definitionHash ?? null,
    acceptedActivationHash: accepted?.activationHash ?? null,
    state: moduleState(release, accepted),
    drift,
    contributionCounts: contributionCounts(definition),
    dependencyFailures,
    acceptedAt: accepted?.acceptedAt ?? null,
    acceptedBy: accepted?.acceptedBy ?? null,
  };
}

function moduleDrift(
  release: BusinessModuleRegistry["modules"][number] | undefined,
  accepted: AcceptedModuleRegistryEntry | undefined,
): BusinessModuleRegistryItem["drift"] {
  if (!release) return "removed";
  if (!accepted) return "new";
  if (accepted.status === "disabled") return "reintroduced";
  if (accepted.definitionHash === release.definitionHash) return "none";
  return accepted.activationHash === release.activationHash ? "presentation" : "activation";
}

function moduleState(
  release: BusinessModuleRegistry["modules"][number] | undefined,
  accepted: AcceptedModuleRegistryEntry | undefined,
): BusinessModuleRegistryItem["state"] {
  if (!release) return "disabled";
  if (!accepted || accepted.status === "disabled") return "pending";
  return accepted.activationHash === release.activationHash ? "active" : "pending";
}

function contributionCounts(
  definition: BusinessModuleRegistry["modules"][number]["definition"],
): BusinessModuleContributionCounts {
  return Object.fromEntries(
    Object.entries(definition.contributions).map(([key, records]) => [key, records.length]),
  ) as BusinessModuleContributionCounts;
}

function removedBindings(
  previous: AcceptedModuleRegistryEntry,
  nextDefinition: BusinessModuleRegistry["modules"][number]["definition"] | null,
  bindingCounts: AuthorizationBindingCounts[],
): ModuleAuthorizationBindingRemoval[] {
  const retainedCodes = new Set(
    nextDefinition?.contributions.permissions.map((permission) => permission.code) ?? [],
  );
  const removedCodes = new Set(
    previous.definition.contributions.permissions
      .map((permission) => permission.code)
      .filter((code) => !retainedCodes.has(code)),
  );
  return bindingCounts.filter((binding) => removedCodes.has(binding.permissionCode));
}
