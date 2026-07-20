import type { BusinessModuleDefinition } from "@web-admin-base/contracts";

export type AcceptedModuleRegistryEntry = {
  definition: BusinessModuleDefinition;
  definitionHash: string;
  activationHash: string;
  status: "active" | "disabled";
  acceptedAt: string;
  acceptedBy: string | null;
  disabledAt: string | null;
};

export type AcceptedModuleRegistrySnapshot = {
  registryHash: string | null;
  acceptedAt: string | null;
  entries: AcceptedModuleRegistryEntry[];
};

export type AuthorizationBindingCounts = {
  permissionCode: string;
  roleBindingCount: number;
  dataRuleCount: number;
  userOverrideCount: number;
};

export type ModuleLifecycleStore = {
  loadSnapshot(): Promise<AcceptedModuleRegistrySnapshot>;
  listEnabledDictionaryTypeCodes(): Promise<Set<string>>;
  listAuthorizationBindingCounts(permissionCodes: string[]): Promise<AuthorizationBindingCounts[]>;
  applyRegistry(input: {
    registryHash: string;
    entries: Array<{
      definition: BusinessModuleDefinition;
      definitionHash: string;
      activationHash: string;
    }>;
    acceptedBy: string | null;
    acceptedAt: string;
  }): Promise<void>;
};
