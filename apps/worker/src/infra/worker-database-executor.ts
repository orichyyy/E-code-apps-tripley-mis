import type { DatabaseAdapterExecutor, DatabaseRow } from "@web-admin-base/adapters";
import {
  createPostgresqlPool,
  createSqliteClient,
  type loadDatabaseConfig,
} from "@web-admin-base/db";

export type WorkerDatabaseConfig = ReturnType<typeof loadDatabaseConfig>;

export function createWorkerDatabaseExecutor(
  config: WorkerDatabaseConfig,
): DatabaseAdapterExecutor {
  return config.dialect === "postgresql"
    ? createPostgresqlWorkerExecutor(config.url)
    : createSqliteWorkerExecutor(config.url);
}

function createPostgresqlWorkerExecutor(url: string): DatabaseAdapterExecutor {
  const pool = createPostgresqlPool(url);
  let activeClient: {
    query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
  } | null = null;

  return {
    dialect: "postgresql",
    async all(sql, params = []) {
      const result = await (activeClient ?? pool).query(sql, params);
      return result.rows as DatabaseRow[];
    },
    async run(sql, params = []) {
      await (activeClient ?? pool).query(sql, params);
    },
    async transaction(operation) {
      if (activeClient) return operation();
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

function createSqliteWorkerExecutor(url: string): DatabaseAdapterExecutor {
  const client = createSqliteClient(url);
  let transactionDepth = 0;

  return {
    dialect: "sqlite",
    async all(sql, params = []) {
      return client.prepare(sql).all(...params) as DatabaseRow[];
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
