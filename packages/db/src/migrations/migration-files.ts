import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { DatabaseDialect } from "../dialects/types";
import { businessModuleMigrationRegistry } from "../business-modules/registry";
import {
  checksumSql,
  readBusinessModuleMigrationFiles,
  type BusinessModuleMigrationSource,
  type ModuleMigrationFile,
} from "./module-migration-source";

const migrationsRoot = dirname(fileURLToPath(import.meta.url));

export type SqlMigration = {
  name: string;
} & ModuleMigrationFile;

export function readMigrationFiles(dialect: DatabaseDialect): SqlMigration[] {
  const directory = join(migrationsRoot, dialect);

  return readdirSync(directory)
    .filter((filename) => filename.endsWith(".sql"))
    .sort()
    .map((filename) => {
      const sql = readFileSync(join(directory, filename), "utf8");
      return {
        id: filename,
        name: filename,
        logicalId: filename.slice(0, -4),
        source: "base-system",
        sql,
        checksum: checksumSql(sql),
      };
    });
}

export function collectMigrationFiles(
  dialect: DatabaseDialect,
  sources: readonly BusinessModuleMigrationSource[] = businessModuleMigrationRegistry,
): SqlMigration[] {
  return [
    ...readMigrationFiles(dialect),
    ...readBusinessModuleMigrationFiles(dialect, sources).map((migration) => ({
      ...migration,
      name: migration.id,
    })),
  ];
}
