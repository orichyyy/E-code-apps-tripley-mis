import type { BusinessModuleDefinition } from "@web-admin-base/contracts";

import { addError } from "./conformance-diagnostics";
import { definitionIdentities } from "./contribution-identities";
import type { ConformanceDiagnostic } from "./conformance-types";

export function validateOwnership(
  definitions: readonly BusinessModuleDefinition[],
  diagnostics: ConformanceDiagnostic[],
): void {
  const owners = new Map<string, string>();
  for (const definition of definitions) {
    registerIdentity(diagnostics, owners, definition, {
      kind: "module",
      identifier: definition.moduleCode,
    });
    for (const contribution of definitionIdentities(definition)) {
      registerIdentity(diagnostics, owners, definition, contribution);
    }
  }
}

function registerIdentity(
  diagnostics: ConformanceDiagnostic[],
  owners: Map<string, string>,
  definition: BusinessModuleDefinition,
  contribution: { kind: string; identifier: string },
): void {
  const ownershipKey = `${contribution.kind}:${contribution.identifier}`;
  const existingOwner = owners.get(ownershipKey);
  if (!existingOwner) {
    owners.set(ownershipKey, definition.moduleCode);
    return;
  }
  addError(
    diagnostics,
    definition,
    contribution,
    "MODULE_DUPLICATE_OWNERSHIP",
    `${contribution.identifier} is already owned by ${existingOwner}`,
  );
}
