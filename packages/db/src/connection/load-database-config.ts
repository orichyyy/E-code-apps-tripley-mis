import { z } from "zod";

const databaseConfigSchema = z.object({
  dialect: z.enum(["sqlite", "postgresql"]).default("sqlite"),
  url: z.string().min(1).default("file:./data/web-admin-base.sqlite")
});

export function loadDatabaseConfig(env: NodeJS.ProcessEnv = process.env) {
  return databaseConfigSchema.parse({
    dialect: env.DATABASE_DIALECT,
    url: env.DATABASE_URL
  });
}
