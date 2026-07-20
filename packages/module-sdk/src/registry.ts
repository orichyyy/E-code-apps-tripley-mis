import type { BusinessModuleDefinition } from "@web-admin-base/contracts";

import { defineBusinessModule } from "./define-business-module";
import { activationHash, definitionHash, sha256 } from "./hashes";

export type BusinessModuleRegistryEntry = {
  definition: BusinessModuleDefinition;
  definitionHash: string;
  activationHash: string;
};

export type BusinessModuleRegistry = {
  modules: BusinessModuleRegistryEntry[];
  registryHash: string;
};

export function createBusinessModuleRegistry(
  definitions: readonly BusinessModuleDefinition[],
): BusinessModuleRegistry {
  const normalizedDefinitions = definitions
    .map((definition) => defineBusinessModule(definition))
    .sort((left, right) => left.moduleCode.localeCompare(right.moduleCode));
  const duplicate = normalizedDefinitions.find(
    (definition, index) => definition.moduleCode === normalizedDefinitions[index - 1]?.moduleCode,
  );

  if (duplicate) {
    throw new Error(`Duplicate Business Module code: ${duplicate.moduleCode}`);
  }

  const modules = normalizedDefinitions.map((definition) => ({
    definition,
    definitionHash: definitionHash(definition),
    activationHash: activationHash(definition),
  }));

  return {
    modules,
    registryHash: sha256(
      modules.map(({ definition, definitionHash: completeHash, activationHash: behaviorHash }) => ({
        moduleCode: definition.moduleCode,
        definitionHash: completeHash,
        activationHash: behaviorHash,
      })),
    ),
  };
}
