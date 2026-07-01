import { defineConfig } from "drizzle-kit";

const dialect = process.env.DATABASE_DIALECT === "postgresql" ? "postgresql" : "sqlite";

export default defineConfig({
  dialect,
  schema: dialect === "postgresql" ? "./src/schema/postgresql.ts" : "./src/schema/sqlite.ts",
  out: dialect === "postgresql" ? "./src/migrations/postgresql" : "./src/migrations/sqlite",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "file:./data/web-admin-base.sqlite"
  }
});
