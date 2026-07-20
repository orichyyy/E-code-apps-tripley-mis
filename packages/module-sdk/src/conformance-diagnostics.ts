import type { BusinessModuleDefinition } from "@web-admin-base/contracts";

import type { ConformanceDiagnostic } from "./conformance-types";

export type ContributionIdentity = {
  kind: string;
  identifier: string;
};

export function addError(
  diagnostics: ConformanceDiagnostic[],
  definition: BusinessModuleDefinition,
  contribution: ContributionIdentity,
  code: string,
  message: string,
): void {
  diagnostics.push({
    severity: "error",
    code,
    moduleCode: definition.moduleCode,
    contributionKind: contribution.kind,
    identifier: contribution.identifier,
    message,
  });
}

export function requirePrefix(
  diagnostics: ConformanceDiagnostic[],
  definition: BusinessModuleDefinition,
  contribution: ContributionIdentity,
  value: string,
  prefix: string,
): void {
  if (value.startsWith(prefix)) return;
  addError(
    diagnostics,
    definition,
    contribution,
    "MODULE_NAMESPACE_VIOLATION",
    `Expected ${value} to start with ${prefix}`,
  );
}
