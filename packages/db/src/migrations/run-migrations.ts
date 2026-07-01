import { databaseDialects, type DatabaseDialect } from "../dialects/types";

const dialect = process.argv[2] as DatabaseDialect | undefined;

if (!dialect || !databaseDialects.includes(dialect)) {
  throw new Error("Usage: tsx src/migrations/run-migrations.ts <sqlite|postgresql>");
}

console.log(`Migration runner placeholder for ${dialect}. Driver wiring is an extension point.`);
