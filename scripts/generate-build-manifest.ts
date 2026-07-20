import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  baseSystemCompatibilityDefinition,
  createOpenApiDocument,
} from "../packages/contracts/src/index";
import { collectMigrationFiles } from "../packages/db/src/index";
import { createBusinessModuleRegistry } from "../packages/module-sdk/src/index";
import { createProductionModuleConformanceInput } from "./business-module-catalog";

const outputPath = resolve("packages/contracts/generated/base-system-manifests.json");
const input = createProductionModuleConformanceInput();
const registry = createBusinessModuleRegistry(input.definitions);

function migrationMetadata(dialect: "sqlite" | "postgresql") {
  return collectMigrationFiles(dialect).map(({ id, logicalId, source, checksum }) => ({
    id,
    logicalId,
    source,
    checksum,
  }));
}

const artifact = {
  artifactVersion: 2,
  baseSystem: baseSystemCompatibilityDefinition,
  businessModules: {
    registryHash: registry.registryHash,
    modules: registry.modules.map(({ definition, definitionHash, activationHash }) => ({
      moduleCode: definition.moduleCode,
      ownerCode: definition.moduleCode,
      definitionHash,
      activationHash,
      definition,
    })),
  },
  migrations: {
    sqlite: migrationMetadata("sqlite"),
    postgresql: migrationMetadata("postgresql"),
  },
  openapi: createOpenApiDocument(),
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);
console.info(`Generated deterministic manifest artifact: ${outputPath}`);
