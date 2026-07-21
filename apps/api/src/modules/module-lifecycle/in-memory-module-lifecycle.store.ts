import type { BusinessModuleDefinition } from "@web-admin-base/contracts";

import type {
  AcceptedModuleRegistryEntry,
  AcceptedModuleRegistrySnapshot,
  AuthorizationBindingCounts,
  ModuleLifecycleStore,
} from "./module-lifecycle.types";

export class InMemoryModuleLifecycleStore implements ModuleLifecycleStore {
  private registryHash: string | null = null;
  private acceptedAt: string | null = null;
  private readonly entries = new Map<string, AcceptedModuleRegistryEntry>();
  private readonly enabledDictionaryTypeCodes = new Set<string>();
  private authorizationBindings: AuthorizationBindingCounts[] = [];

  loadSnapshot(): Promise<AcceptedModuleRegistrySnapshot> {
    return Promise.resolve({
      registryHash: this.registryHash,
      acceptedAt: this.acceptedAt,
      entries: [...this.entries.values()].map(cloneEntry),
    });
  }

  listEnabledDictionaryTypeCodes(): Promise<Set<string>> {
    return Promise.resolve(new Set(this.enabledDictionaryTypeCodes));
  }

  listAuthorizationBindingCounts(permissionCodes: string[]): Promise<AuthorizationBindingCounts[]> {
    const requested = new Set(permissionCodes);
    return Promise.resolve(
      this.authorizationBindings
        .filter((binding) => requested.has(binding.permissionCode))
        .map((binding) => ({ ...binding })),
    );
  }

  applyRegistry(input: {
    registryHash: string;
    entries: Array<{
      definition: BusinessModuleDefinition;
      definitionHash: string;
      activationHash: string;
    }>;
    acceptedBy: string | null;
    acceptedAt: string;
  }): Promise<void> {
    const releaseCodes = new Set(input.entries.map((entry) => entry.definition.moduleCode));
    for (const [moduleCode, entry] of this.entries) {
      if (releaseCodes.has(moduleCode) || entry.status === "disabled") continue;
      this.entries.set(moduleCode, {
        ...entry,
        status: "disabled",
        disabledAt: input.acceptedAt,
      });
    }
    for (const entry of input.entries) {
      this.entries.set(entry.definition.moduleCode, {
        definition: structuredClone(entry.definition),
        definitionHash: entry.definitionHash,
        activationHash: entry.activationHash,
        status: "active",
        acceptedAt: input.acceptedAt,
        acceptedBy: input.acceptedBy,
        disabledAt: null,
      });
    }
    this.registryHash = input.registryHash;
    this.acceptedAt = input.acceptedAt;
    return Promise.resolve();
  }

  enableDictionaryType(code: string): void {
    this.enabledDictionaryTypeCodes.add(code);
  }

  setAuthorizationBindings(bindings: AuthorizationBindingCounts[]): void {
    this.authorizationBindings = bindings.map((binding) => ({ ...binding }));
  }
}

function cloneEntry(entry: AcceptedModuleRegistryEntry): AcceptedModuleRegistryEntry {
  return {
    ...entry,
    definition: structuredClone(entry.definition),
  };
}
