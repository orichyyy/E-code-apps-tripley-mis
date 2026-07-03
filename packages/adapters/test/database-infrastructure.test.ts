import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  createPostgresqlPool,
  createSqliteClient,
  runPostgresqlMigrations,
  runSqliteMigrations
} from "@web-admin-base/db";
import { describe, expect, it } from "vitest";

import {
  createDatabaseCacheAdapter,
  createDatabaseEventBusAdapter,
  createDatabaseJobSchedulerAdapter,
  createDatabaseLockAdapter,
  createDatabaseQueueAdapter,
  createDatabaseRateLimitAdapter,
  type DatabaseAdapterExecutor
} from "../src";

const postgresqlUrl = process.env.TEST_DATABASE_URL;

describe("database infrastructure adapters", () => {
  it("runs against SQLite for local/demo compatibility", async () => {
    const filename = join(tmpdir(), `web-admin-adapters-${process.pid}-${Date.now()}.sqlite`);
    runSqliteMigrations({ url: `file:${filename}` });
    const executor = createSqliteTestExecutor(`file:${filename}`);

    try {
      await expectInfrastructureAdapters(executor);
    } finally {
      await executor.close();
      if (existsSync(filename)) rmSync(filename, { force: true });
    }
  });

  it.runIf(postgresqlUrl)("runs against PostgreSQL durable tables", async () => {
    const url = getPostgresqlUrl();
    await runPostgresqlMigrations({ url });
    const executor = createPostgresqlTestExecutor(url);

    try {
      await clearInfrastructureTables(executor);
      await expectInfrastructureAdapters(executor);
    } finally {
      await clearInfrastructureTables(executor);
      await executor.close();
    }
  });
});

async function expectInfrastructureAdapters(executor: DatabaseAdapterExecutor): Promise<void> {
  const cache = createDatabaseCacheAdapter(executor);
  const rateLimit = createDatabaseRateLimitAdapter(executor);
  const locks = createDatabaseLockAdapter(executor, { owner: "test-worker" });
  const queue = createDatabaseQueueAdapter(executor, { workerId: "test-worker" });
  const events = createDatabaseEventBusAdapter(executor);
  const scheduler = createDatabaseJobSchedulerAdapter(executor);
  const handledJobs: string[] = [];
  const handledEvents: string[] = [];
  const handledSchedules: string[] = [];

  await cache.set("config:language", { value: "en" });
  await expect(cache.get("config:language")).resolves.toEqual({ value: "en" });

  await expect(rateLimit.check("login:admin", 2, 60)).resolves.toMatchObject({ allowed: true, remaining: 1 });
  await expect(rateLimit.check("login:admin", 2, 60)).resolves.toMatchObject({ allowed: true, remaining: 0 });
  await expect(rateLimit.check("login:admin", 2, 60)).resolves.toMatchObject({ allowed: false, remaining: 0 });

  const firstLock = await locks.acquire("scheduled:cleanup");
  const blockedLock = await createDatabaseLockAdapter(executor, { owner: "other-worker" }).acquire("scheduled:cleanup");
  await firstLock?.release();
  const secondLock = await createDatabaseLockAdapter(executor, { owner: "other-worker" }).acquire("scheduled:cleanup");
  await secondLock?.release();
  expect(firstLock?.key).toBe("scheduled:cleanup");
  expect(blockedLock).toBeNull();
  expect(secondLock?.key).toBe("scheduled:cleanup");

  await queue.consume("log.write", async (job) => {
    handledJobs.push((job.payload as { message: string }).message);
  });
  await queue.enqueue("log.write", { message: "created" });
  await expect(queue.processReady()).resolves.toBe(1);
  expect(handledJobs).toEqual(["created"]);

  await events.subscribe("notification.created", async (event) => {
    handledEvents.push((event.payload as { title: string }).title);
  });
  await events.publish({
    id: "ignored-client-id",
    type: "notification.created",
    payload: { title: "Welcome" },
    occurredAt: "2026-07-03T00:00:00.000Z"
  });
  await expect(events.processNext()).resolves.toBe(true);
  expect(handledEvents).toEqual(["Welcome"]);

  await scheduler.register({ code: "cleanup", cronExpression: "* * * * *", enabled: true }, async () => {
    handledSchedules.push("cleanup");
  });
  await expect(scheduler.processDue()).resolves.toBe(1);
  expect(handledSchedules).toEqual(["cleanup"]);
}

async function clearInfrastructureTables(executor: DatabaseAdapterExecutor): Promise<void> {
  for (const table of [
    "event_outbox",
    "queue_jobs",
    "scheduled_jobs",
    "cache_entries",
    "rate_limit_counters",
    "locks"
  ]) {
    await executor.run(`DELETE FROM ${table}`);
  }
}

function getPostgresqlUrl(): string {
  if (!postgresqlUrl) throw new Error("TEST_DATABASE_URL is required for PostgreSQL adapter tests.");
  return postgresqlUrl;
}

function createPostgresqlTestExecutor(url: string): DatabaseAdapterExecutor {
  const pool = createPostgresqlPool(url);
  let activeClient: { query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }> } | null = null;

  return {
    dialect: "postgresql",
    async all(sql, params = []) {
      const result = await (activeClient ?? pool).query(sql, params);
      return result.rows as Array<Record<string, unknown>>;
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
    }
  };
}

function createSqliteTestExecutor(url: string): DatabaseAdapterExecutor {
  const client = createSqliteClient(url);
  let transactionDepth = 0;

  return {
    dialect: "sqlite",
    async all(sql, params = []) {
      return client.prepare(sql).all(...params) as Array<Record<string, unknown>>;
    },
    async run(sql, params = []) {
      client.prepare(sql).run(...params);
    },
    async transaction(operation) {
      if (transactionDepth > 0) return operation();
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
    }
  };
}
