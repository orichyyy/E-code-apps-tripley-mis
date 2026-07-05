import { createPostgresqlPool, createSqliteClient } from "@web-admin-base/db";
import type { DatabaseDialect } from "@web-admin-base/db";

export type QueryRow = Record<string, unknown>;

export type QueryExecutor = {
  dialect: DatabaseDialect;
  all(sql: string, params?: unknown[]): Promise<QueryRow[]>;
  run(sql: string, params?: unknown[]): Promise<void>;
  transaction<T>(operation: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
};

export function createPostgresqlExecutor(url: string): QueryExecutor {
  const pool = createPostgresqlPool(url);
  let activeClient: {
    query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
  } | null = null;

  return {
    dialect: "postgresql",
    async all(sql, params = []) {
      const result = await (activeClient ?? pool).query(sql, params);
      return result.rows as QueryRow[];
    },
    async run(sql, params = []) {
      await (activeClient ?? pool).query(sql, params);
    },
    async transaction(operation) {
      if (activeClient) {
        return operation();
      }

      const client = await pool.connect();
      activeClient = client;
      try {
        await client.query("BEGIN");
        const result = await operation();
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        activeClient = null;
        client.release();
      }
    },
    async close() {
      await pool.end();
    },
  };
}

export function createSqliteExecutor(url: string): QueryExecutor {
  const client = createSqliteClient(url);
  let transactionDepth = 0;

  return {
    dialect: "sqlite",
    async all(sql, params = []) {
      return client.prepare(sql).all(...params) as QueryRow[];
    },
    async run(sql, params = []) {
      client.prepare(sql).run(...params);
    },
    async transaction(operation) {
      if (transactionDepth > 0) {
        transactionDepth += 1;
        try {
          return await operation();
        } finally {
          transactionDepth -= 1;
        }
      }

      transactionDepth = 1;
      await this.run("BEGIN");
      try {
        const result = await operation();
        await this.run("COMMIT");
        return result;
      } catch (error) {
        await this.run("ROLLBACK");
        throw error;
      } finally {
        transactionDepth = 0;
      }
    },
    async close() {
      client.close();
    },
  };
}
