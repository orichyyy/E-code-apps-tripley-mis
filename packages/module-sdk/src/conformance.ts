import {
  type BusinessModuleConformanceInput,
  type BusinessModuleConformanceReport,
  type ConformanceDiagnostic,
} from "./conformance-types";
import { validateNamespaces } from "./namespace-validation";
import { validateOwnership } from "./ownership-validation";
import { validateReferences } from "./reference-validation";
import { validateRuntime } from "./runtime-validation";

export function checkBusinessModuleConformance(
  input: BusinessModuleConformanceInput,
): BusinessModuleConformanceReport {
  const diagnostics: ConformanceDiagnostic[] = [];
  validateOwnership(input.definitions, diagnostics);
  for (const definition of input.definitions) {
    validateNamespaces(definition, diagnostics);
    validateReferences(definition, diagnostics, input.baseMenuCodes ?? []);
  }
  validateRuntime(input, diagnostics);
  diagnostics.sort((left, right) => diagnosticKey(left).localeCompare(diagnosticKey(right)));
  return { ok: diagnostics.length === 0, diagnostics };
}

function diagnosticKey(diagnostic: ConformanceDiagnostic): string {
  return [
    diagnostic.moduleCode ?? "",
    diagnostic.contributionKind,
    diagnostic.identifier ?? "",
    diagnostic.code,
  ].join(":");
}
