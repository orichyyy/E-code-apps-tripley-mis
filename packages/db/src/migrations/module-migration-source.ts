import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { DatabaseDialect } from "../dialects/types";

export type BusinessModuleMigrationSource = {
  moduleCode: string;
  sqliteDirectory: string;
  postgresqlDirectory: string;
};

export type ModuleMigrationFile = {
  id: string;
  logicalId: string;
  source: string;
  sql: string;
  checksum: string;
};

const migrationFilenamePattern = /^(\d{4})_([a-z0-9]+(?:_[a-z0-9]+)*)\.sql$/;
const moduleCodePattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

function migrationFiles(directory: string): string[] {
  return readdirSync(directory)
    .filter((filename) => filename.endsWith(".sql"))
    .sort();
}

function logicalId(filename: string): string {
  const match = migrationFilenamePattern.exec(filename);
  if (!match) {
    throw new Error(`Business Module migration ${filename} must match NNNN_lower_snake_name.sql.`);
  }
  return filename.slice(0, -4);
}

export function checksumSql(sql: string): string {
  return createHash("sha256").update(sql, "utf8").digest("hex");
}

export function validateBusinessModuleMigrationSources(
  sources: readonly BusinessModuleMigrationSource[],
): void {
  const moduleCodes = new Set<string>();
  for (const source of sources) {
    if (!moduleCodePattern.test(source.moduleCode)) {
      throw new Error(
        `Business Module migration source ${source.moduleCode} must use a lower kebab-case Module Code.`,
      );
    }
    if (moduleCodes.has(source.moduleCode)) {
      throw new Error(`Duplicate Business Module migration source: ${source.moduleCode}.`);
    }
    moduleCodes.add(source.moduleCode);
    const sqliteIds = migrationFiles(source.sqliteDirectory).map(logicalId);
    const postgresqlIds = migrationFiles(source.postgresqlDirectory).map(logicalId);
    if (JSON.stringify(sqliteIds) !== JSON.stringify(postgresqlIds)) {
      throw new Error(
        `Business Module ${source.moduleCode} must expose matching logical migration IDs for SQLite and PostgreSQL.`,
      );
    }
  }
}

export function readBusinessModuleMigrationFiles(
  dialect: DatabaseDialect,
  sources: readonly BusinessModuleMigrationSource[],
): ModuleMigrationFile[] {
  validateBusinessModuleMigrationSources(sources);
  return [...sources]
    .sort((left, right) => left.moduleCode.localeCompare(right.moduleCode))
    .flatMap((source) => {
      const directory = dialect === "sqlite" ? source.sqliteDirectory : source.postgresqlDirectory;
      return migrationFiles(directory).map((filename) => {
        const id = logicalId(filename);
        const sql = readFileSync(join(directory, filename), "utf8");
        return {
          id: `module:${source.moduleCode}:${id}`,
          logicalId: id,
          source: source.moduleCode,
          sql,
          checksum: checksumSql(sql),
        };
      });
    });
}
