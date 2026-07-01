import { databaseDialects, type DatabaseDialect } from "../dialects/types";

const target = process.argv[2] as DatabaseDialect | "all" | undefined;

if (!target || (target !== "all" && !databaseDialects.includes(target))) {
  throw new Error("Usage: tsx src/migrations/run-migrations.ts <all|sqlite|postgresql>");
}

throw new Error(
  `Database migration execution for ${target} is blocked until the SQLite driver and PostgreSQL test/provisioning strategy are confirmed in docs/implementation_questions.md.`
);
