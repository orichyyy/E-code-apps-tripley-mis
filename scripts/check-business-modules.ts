import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  checkBusinessModuleConformance,
  createBusinessModuleRegistry,
  formatConformanceDiagnostic,
} from "../packages/module-sdk/src/index";
import {
  businessModuleMigrationRegistry,
  validateBusinessModuleMigrationSources,
} from "../packages/db/src/index";
import { createProductionModuleConformanceInput } from "./business-module-catalog";

const outputPath = resolve(".tmp/business-module-conformance.json");
const input = createProductionModuleConformanceInput();
const report = checkBusinessModuleConformance(input);
try {
  validateBusinessModuleMigrationSources(businessModuleMigrationRegistry);
} catch (error) {
  report.diagnostics.push({
    severity: "error",
    code: "MODULE_MIGRATION_SOURCE_INVALID",
    contributionKind: "migration",
    message: error instanceof Error ? error.message : String(error),
  });
  report.ok = false;
}
const registry = createBusinessModuleRegistry(input.definitions);
const output = {
  contractVersion: 1,
  registryHash: registry.registryHash,
  moduleCount: registry.modules.length,
  ...report,
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);

if (report.ok) {
  console.info(
    `Business Module conformance passed (${registry.modules.length} production modules).`,
  );
  console.info(`JSON report: ${outputPath}`);
} else {
  for (const diagnostic of report.diagnostics) {
    console.error(formatConformanceDiagnostic(diagnostic));
  }
  console.error(`JSON report: ${outputPath}`);
  process.exitCode = 1;
}
