import { loadDatabaseConfig } from "../connection/load-database-config";
import { databaseDialects, type DatabaseDialect } from "../dialects/types";
import { runPostgresqlMigrations } from "./postgresql-runner";
import { runSqliteMigrations } from "./sqlite-runner";

const target = process.argv[2] as DatabaseDialect | "all" | undefined;

if (!target || (target !== "all" && !databaseDialects.includes(target))) {
  throw new Error("Usage: tsx src/migrations/run-migrations.ts <all|sqlite|postgresql>");
}

await runMigrationTarget(target, process.env);

export async function runMigrationTarget(
  migrationTarget: DatabaseDialect | "all",
  env: NodeJS.ProcessEnv,
): Promise<void> {
  if (migrationTarget === "sqlite") {
    const applied = runSqliteMigrations({
      url: loadDatabaseConfig({ ...env, DATABASE_DIALECT: "sqlite" }).url,
    });
    reportApplied("sqlite", applied);
    return;
  }

  if (migrationTarget === "postgresql") {
    const url = getPostgresqlUrl(env, true);
    const applied = await runPostgresqlMigrations({ url });
    reportApplied("postgresql", applied);
    return;
  }

  const sqliteApplied = runSqliteMigrations({
    url: loadDatabaseConfig({ ...env, DATABASE_DIALECT: "sqlite" }).url,
  });
  reportApplied("sqlite", sqliteApplied);

  const postgresqlUrl = getPostgresqlUrl(env, false);
  if (!postgresqlUrl) {
    console.info(
      "Skipping PostgreSQL migrations because TEST_DATABASE_URL/DATABASE_URL is not set.",
    );
    return;
  }

  const postgresqlApplied = await runPostgresqlMigrations({ url: postgresqlUrl });
  reportApplied("postgresql", postgresqlApplied);
}

function getPostgresqlUrl(env: NodeJS.ProcessEnv, required: true): string;
function getPostgresqlUrl(env: NodeJS.ProcessEnv, required: false): string | undefined;
function getPostgresqlUrl(env: NodeJS.ProcessEnv, required: boolean): string | undefined {
  const url = env.TEST_DATABASE_URL ?? env.DATABASE_URL;

  if (!url && required) {
    throw new Error("PostgreSQL migrations require TEST_DATABASE_URL or DATABASE_URL.");
  }

  return url;
}

function reportApplied(dialect: DatabaseDialect, applied: string[]): void {
  console.info(`Applied ${applied.length} ${dialect} migration(s): ${applied.join(", ")}`);
}
