import type {
  ApplyModuleSyncRequest,
  BaseApiPermissionManifestEntry,
  BusinessModuleRegistryResponse,
  ModuleSyncApplyResponse,
  ModuleSyncPlanResponse,
} from "@web-admin-base/contracts";
import type { BusinessModuleRegistry } from "@web-admin-base/module-sdk";

import { createKnownError } from "../../core/errors/error-codes";
import type { ModuleLifecycleStore } from "./module-lifecycle.types";
import {
  buildModuleSyncPlan,
  describeBusinessModuleRegistry,
  findDependencyFailures,
} from "./module-sync-plan";

export type ModuleLifecycleHooks = {
  afterApply?: (
    definitions: import("@web-admin-base/contracts").BusinessModuleDefinition[],
  ) => Promise<void>;
  beforeCompatibilitySync?: () => Promise<void>;
};

export class ModuleLifecycleService {
  constructor(
    private readonly registry: BusinessModuleRegistry,
    private readonly store: ModuleLifecycleStore,
    private readonly hooks: ModuleLifecycleHooks = {},
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async getRegistry(): Promise<BusinessModuleRegistryResponse> {
    const [accepted, enabledDictionaryTypes] = await Promise.all([
      this.store.loadSnapshot(),
      this.store.listEnabledDictionaryTypeCodes(),
    ]);
    const failures = findDependencyFailures(this.registry, enabledDictionaryTypes);
    return describeBusinessModuleRegistry(this.registry, accepted, failures);
  }

  async plan(): Promise<ModuleSyncPlanResponse> {
    const [accepted, enabledDictionaryTypes] = await Promise.all([
      this.store.loadSnapshot(),
      this.store.listEnabledDictionaryTypeCodes(),
    ]);
    const permissionCodes = accepted.entries.flatMap((entry) =>
      entry.definition.contributions.permissions.map((permission) => permission.code),
    );
    const bindings = await this.store.listAuthorizationBindingCounts(permissionCodes);
    return buildModuleSyncPlan(this.registry, accepted, enabledDictionaryTypes, bindings);
  }

  async apply(
    input: ApplyModuleSyncRequest,
    acceptedBy: string | null,
  ): Promise<ModuleSyncApplyResponse> {
    if (input.expectedRegistryHash !== this.registry.registryHash) {
      throw createKnownError("BUSINESS_MODULE_REGISTRY_STALE");
    }
    return this.applyCurrentRegistry(acceptedBy);
  }

  async bootstrap(acceptedBy: string | null): Promise<ModuleSyncApplyResponse> {
    return this.applyCurrentRegistry(acceptedBy);
  }

  async assertCanApply(): Promise<void> {
    if (!(await this.plan()).canApply) {
      throw createKnownError("BUSINESS_MODULE_DEPENDENCY_UNSATISFIED");
    }
  }

  async synchronizeCompatibility(acceptedBy: string | null): Promise<void> {
    const plan = await this.plan();
    if (!plan.canApply) throw createKnownError("BUSINESS_MODULE_DEPENDENCY_UNSATISFIED");
    await this.hooks.beforeCompatibilitySync?.();
    const acceptedAt = this.now();
    const definitions = this.registry.modules.map((entry) => entry.definition);
    await this.store.applyRegistry({
      registryHash: this.registry.registryHash,
      entries: this.registry.modules,
      acceptedBy,
      acceptedAt,
    });
    await this.hooks.afterApply?.(definitions);
  }

  async isModuleActive(moduleCode: string): Promise<boolean> {
    const release = this.registry.modules.find(
      (entry) => entry.definition.moduleCode === moduleCode,
    );
    if (!release) return false;
    const accepted = (await this.store.loadSnapshot()).entries.find(
      (entry) => entry.definition.moduleCode === moduleCode,
    );
    return accepted?.status === "active" && accepted.activationHash === release.activationHash;
  }

  async getActiveDefinitions(): Promise<
    import("@web-admin-base/contracts").BusinessModuleDefinition[]
  > {
    const accepted = await this.store.loadSnapshot();
    const acceptedByCode = new Map(
      accepted.entries.map((entry) => [entry.definition.moduleCode, entry]),
    );
    return this.registry.modules
      .filter(({ definition, activationHash }) => {
        const entry = acceptedByCode.get(definition.moduleCode);
        return entry?.status === "active" && entry.activationHash === activationHash;
      })
      .map((entry) => entry.definition);
  }

  hasReleaseModule(moduleCode: string): boolean {
    return this.registry.modules.some((entry) => entry.definition.moduleCode === moduleCode);
  }

  findReleaseApiPermission(
    method: string,
    path: string,
  ): BaseApiPermissionManifestEntry | undefined {
    for (const entry of this.registry.modules) {
      const api = entry.definition.contributions.apis.find(
        (candidate) => candidate.method === method && matchesPath(candidate.path, path),
      );
      if (!api) continue;
      return {
        method: api.method,
        path: api.path,
        code: api.code,
        description: api.description.defaultMessage,
        module: entry.definition.moduleCode,
        requiredPermission: api.requiredPermission,
        logLevel: api.logLevel,
        public: false,
      };
    }
    return undefined;
  }

  private async applyCurrentRegistry(acceptedBy: string | null): Promise<ModuleSyncApplyResponse> {
    const plan = await this.plan();
    if (!plan.canApply) throw createKnownError("BUSINESS_MODULE_DEPENDENCY_UNSATISFIED");
    const previous = await this.store.loadSnapshot();
    const acceptedAt = this.now();
    const applied = plan.changes.length > 0 || previous.registryHash !== this.registry.registryHash;

    if (applied) {
      await this.store.applyRegistry({
        registryHash: this.registry.registryHash,
        entries: this.registry.modules,
        acceptedBy,
        acceptedAt,
      });
    }
    await this.hooks.afterApply?.(this.registry.modules.map((entry) => entry.definition));

    const catalog = await this.getRegistry();
    return {
      applied,
      registryHash: this.registry.registryHash,
      acceptedAt: applied ? acceptedAt : (previous.acceptedAt ?? acceptedAt),
      modules: catalog.modules,
    };
  }
}

function matchesPath(pattern: string, path: string): boolean {
  const patternParts = pattern.split("/");
  const pathParts = path.split("/");
  return (
    patternParts.length === pathParts.length &&
    patternParts.every((part, index) => part.startsWith(":") || part === pathParts[index])
  );
}
