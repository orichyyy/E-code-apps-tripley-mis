import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

import { postgresqlSchema } from "../schema/postgresql";

export type PostgresqlDatabase = ReturnType<typeof createPostgresqlDatabase>;

export function createPostgresqlDatabase(url: string) {
  const pool = createPostgresqlPool(url);

  return drizzle(pool, { schema: postgresqlSchema });
}

export function createPostgresqlPool(url: string): Pool {
  return new Pool({ connectionString: url });
}
