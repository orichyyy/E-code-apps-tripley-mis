import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { DatabaseDialect } from "../dialects/types";

const migrationsRoot = dirname(fileURLToPath(import.meta.url));

export type SqlMigration = {
  name: string;
  sql: string;
};

export function readMigrationFiles(dialect: DatabaseDialect): SqlMigration[] {
  const directory = join(migrationsRoot, dialect);

  return readdirSync(directory)
    .filter((filename) => filename.endsWith(".sql"))
    .sort()
    .map((filename) => ({
      name: filename,
      sql: readFileSync(join(directory, filename), "utf8"),
    }));
}
