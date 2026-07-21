import { checkBusinessModuleConformance } from "./conformance";
import type {
  BusinessModuleConformanceInput,
  BusinessModuleConformanceReport,
  ConformanceDiagnostic,
} from "./conformance-types";

export function formatConformanceDiagnostic(diagnostic: ConformanceDiagnostic): string {
  const owner = diagnostic.moduleCode ? `[${diagnostic.moduleCode}] ` : "";
  const identifier = diagnostic.identifier ? ` ${diagnostic.identifier}` : "";
  return `${diagnostic.code}: ${owner}${diagnostic.contributionKind}${identifier}: ${diagnostic.message}`;
}

export function assertBusinessModuleConformance(
  input: BusinessModuleConformanceInput,
): BusinessModuleConformanceReport {
  const report = checkBusinessModuleConformance(input);
  if (!report.ok) {
    throw new Error(report.diagnostics.map(formatConformanceDiagnostic).join("\n"));
  }
  return report;
}
