import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  createPostgresqlPool,
  createSqliteClient,
  runPostgresqlMigrations,
  runSqliteMigrations,
} from "@web-admin-base/db";
import { describe, expect, it } from "vitest";

import {
  createDatabaseCacheAdapter,
  createDatabaseEventBusAdapter,
  createDatabaseJobSchedulerAdapter,
  createDatabaseLockAdapter,
  createDatabaseWebhookNotificationPublisher,
  createWebhookNotificationChannelAdapter,
  createDatabaseQueueAdapter,
  createDatabaseRateLimitAdapter,
  computeNextCronRun,
  readJson,
  type DatabaseAdapterExecutor,
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

  it.runIf(postgresqlUrl)("returns one winner for a concurrent PostgreSQL lease", async () => {
    const url = getPostgresqlUrl();
    await runPostgresqlMigrations({ url });
    const firstExecutor = createPostgresqlTestExecutor(url);
    const secondExecutor = createPostgresqlTestExecutor(url);
    const key = `concurrent-lock-${process.pid}-${Date.now()}`;
    try {
      const [first, second] = await Promise.all([
        createDatabaseLockAdapter(firstExecutor, { owner: "first" }).acquire(key),
        createDatabaseLockAdapter(secondExecutor, { owner: "second" }).acquire(key),
      ]);
      expect([first, second].filter(Boolean)).toHaveLength(1);
      await (first ?? second)?.release();
      await expect(
        createDatabaseLockAdapter(secondExecutor, { owner: "next" }).acquire(key),
      ).resolves.not.toBeNull();
    } finally {
      await firstExecutor.run("DELETE FROM locks WHERE key = $1", [key]);
      await firstExecutor.close();
      await secondExecutor.close();
    }
  });

  it("computes the next supported cron run in UTC", () => {
    expect(computeNextCronRun("* * * * *", new Date("2026-07-04T12:34:45.000Z"))).toBe(
      "2026-07-04T12:35:00.000Z",
    );
    expect(computeNextCronRun("0 0 * * *", new Date("2026-07-04T12:34:45.000Z"))).toBe(
      "2026-07-05T00:00:00.000Z",
    );
    expect(computeNextCronRun("0 9 1 * 1", new Date("2026-07-04T00:00:00.000Z"))).toBe(
      "2026-07-06T09:00:00.000Z",
    );
  });
});

async function expectInfrastructureAdapters(executor: DatabaseAdapterExecutor): Promise<void> {
  const cache = createDatabaseCacheAdapter(executor);
  const rateLimit = createDatabaseRateLimitAdapter(executor);
  const locks = createDatabaseLockAdapter(executor, { owner: "test-worker" });
  const queue = createDatabaseQueueAdapter(executor, {
    workerId: "test-worker",
    maxAttempts: 2,
    retryDelaySeconds: 0,
  });
  const events = createDatabaseEventBusAdapter(executor);
  const scheduler = createDatabaseJobSchedulerAdapter(executor, { retryDelaySeconds: 0 });
  const handledJobs: string[] = [];
  const handledEvents: string[] = [];
  const handledSchedules: string[] = [];

  await cache.set("config:language", { value: "en" });
  await expect(cache.get("config:language")).resolves.toEqual({ value: "en" });

  await expect(rateLimit.check("login:admin", 2, 60)).resolves.toMatchObject({
    allowed: true,
    remaining: 1,
  });
  await expect(rateLimit.check("login:admin", 2, 60)).resolves.toMatchObject({
    allowed: true,
    remaining: 0,
  });
  await expect(rateLimit.check("login:admin", 2, 60)).resolves.toMatchObject({
    allowed: false,
    remaining: 0,
  });

  const firstLock = await locks.acquire("scheduled:cleanup");
  const blockedLock = await createDatabaseLockAdapter(executor, { owner: "other-worker" }).acquire(
    "scheduled:cleanup",
  );
  await firstLock?.release();
  const secondLock = await createDatabaseLockAdapter(executor, { owner: "other-worker" }).acquire(
    "scheduled:cleanup",
  );
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

  await queue.consume("log.fail", async () => {
    throw new Error("write failed");
  });
  await queue.enqueue("log.fail", { message: "broken" });
  await expect(queue.processNext("log.fail")).resolves.toBe(true);
  await expect(queue.processNext("log.fail")).resolves.toBe(true);
  const failedJobs = await executor.all(
    "SELECT status, attempt, last_error FROM queue_jobs WHERE type = 'log.fail'",
  );
  expect(failedJobs.map((row) => ({ ...row, attempt: Number(row.attempt) }))).toEqual([
    expect.objectContaining({ status: "dead_letter", attempt: 2, last_error: "write failed" }),
  ]);

  const eventQueue = createDatabaseQueueAdapter(executor, {
    workerId: "event-worker",
    maxAttempts: 1,
    retryDelaySeconds: 0,
    emitJobFailureEvents: true,
  });
  for (const type of ["base.fail", "webhook.internal.fail"]) {
    await eventQueue.consume(type, async () => {
      throw new Error("final failure");
    });
    await eventQueue.enqueue(type, {});
    await eventQueue.processNext(type);
  }
  const queueFailureEvents = await executor.all(
    "SELECT event_type, payload_json FROM event_outbox WHERE event_type = 'job.failed'",
  );
  expect(queueFailureEvents).toHaveLength(1);
  expect(JSON.stringify(queueFailureEvents[0]?.payload_json)).toContain("base.fail");

  const staleAt = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  await executor.run(
    `INSERT INTO queue_jobs (type, payload_json, status, attempt, max_attempts, available_at, locked_by, locked_at, created_at, updated_at)
     VALUES (${marker(executor, 1)}, ${marker(executor, 2)}, 'running', 1, 2, ${marker(executor, 3)}, 'stale-worker', ${marker(executor, 4)}, ${marker(executor, 5)}, ${marker(executor, 6)})`,
    [
      "log.write",
      jsonPayload({ message: "recovered" }, executor),
      staleAt,
      staleAt,
      staleAt,
      staleAt,
    ],
  );
  await expect(queue.processNext("log.write")).resolves.toBe(true);
  expect(handledJobs).toEqual(["created", "recovered"]);

  await events.subscribe("notification.created", async (event) => {
    handledEvents.push((event.payload as { title: string }).title);
  });
  await events.publish({
    id: "ignored-client-id",
    type: "notification.created",
    payload: { title: "Welcome" },
    occurredAt: "2026-07-03T00:00:00.000Z",
  });
  await expect(events.processNext()).resolves.toBe(true);
  if (handledEvents.length === 0) await expect(events.processNext()).resolves.toBe(true);
  expect(handledEvents).toEqual(["Welcome"]);

  await scheduler.register(
    { code: "cleanup", cronExpression: "* * * * *", enabled: true },
    async () => {
      handledSchedules.push("cleanup");
    },
  );
  await expect(scheduler.processDue()).resolves.toBe(0);
  await executor.run(
    "UPDATE scheduled_jobs SET next_run_at = '2026-01-01T00:00:00.000Z' WHERE code = 'cleanup'",
  );
  await expect(scheduler.processDue()).resolves.toBe(1);
  expect(handledSchedules).toEqual(["cleanup"]);
  const schedulerRows = await executor.all(
    "SELECT next_run_at, attempt, last_error FROM scheduled_jobs WHERE code = 'cleanup'",
  );
  const schedulerLogs = await executor.all(
    "SELECT log_type, level, message FROM log_entries WHERE log_type = 'scheduler'",
  );
  expect(new Date(String(schedulerRows[0]?.next_run_at)).getTime()).toBeGreaterThan(
    Date.now() - 1_000,
  );
  expect(schedulerRows.map((row) => ({ ...row, attempt: Number(row.attempt) }))).toEqual([
    expect.objectContaining({ attempt: 0, last_error: null }),
  ]);
  expect(schedulerLogs).toEqual([
    expect.objectContaining({
      log_type: "scheduler",
      level: "info",
      message: "Scheduled job succeeded",
    }),
  ]);

  await scheduler.register(
    { code: "failing-cleanup", cronExpression: "* * * * *", enabled: true },
    async () => {
      throw new Error("cleanup failed");
    },
  );
  await executor.run(
    "UPDATE scheduled_jobs SET next_run_at = '2026-01-01T00:00:00.000Z', max_attempts = 2 WHERE code = 'failing-cleanup'",
  );
  await expect(scheduler.processDue()).resolves.toBe(2);
  await expect(scheduler.processDue()).resolves.toBe(0);
  const failedScheduleRows = await executor.all(
    "SELECT attempt, last_error, next_run_at FROM scheduled_jobs WHERE code = 'failing-cleanup'",
  );
  const errorLogs = await executor.all(
    "SELECT level, message FROM log_entries WHERE log_type = 'scheduler' AND level = 'error' ORDER BY id ASC",
  );
  expect(failedScheduleRows.map((row) => ({ ...row, attempt: Number(row.attempt) }))).toEqual([
    expect.objectContaining({ attempt: 0, last_error: "cleanup failed" }),
  ]);
  expect(new Date(String(failedScheduleRows[0]?.next_run_at)).getTime()).toBeGreaterThan(
    Date.now() - 1_000,
  );
  expect(errorLogs).toEqual([
    expect.objectContaining({ level: "error", message: "cleanup failed" }),
    expect.objectContaining({ level: "error", message: "cleanup failed" }),
  ]);

  const eventScheduler = createDatabaseJobSchedulerAdapter(executor, {
    retryDelaySeconds: 0,
    emitJobFailureEvents: true,
  });
  for (const code of ["base.schedule.fail", "webhook.schedule.fail"]) {
    await eventScheduler.register(
      { code, cronExpression: "* * * * *", enabled: true },
      async () => {
        throw new Error("final scheduled failure");
      },
    );
    await executor.run(
      `UPDATE scheduled_jobs SET next_run_at = ${marker(executor, 1)}, max_attempts = 1 WHERE code = ${marker(executor, 2)}`,
      ["2026-01-01T00:00:00.000Z", code],
    );
  }
  await eventScheduler.processDue(2);
  const allFailureEvents = await executor.all(
    "SELECT payload_json FROM event_outbox WHERE event_type = 'job.failed' ORDER BY id",
  );
  expect(allFailureEvents).toHaveLength(2);
  expect(JSON.stringify(allFailureEvents[1]?.payload_json)).toContain("base.schedule.fail");

  const webhookNotifications = createWebhookNotificationChannelAdapter({
    enabled: true,
    publisher: createDatabaseWebhookNotificationPublisher(executor),
    now: () => "2026-07-17T00:00:00.000Z",
  });
  await webhookNotifications.send({
    channel: "webhook",
    recipient: "42",
    subject: "Directed notification",
    body: "A safe body",
    metadata: { notificationId: "91", locale: "en" },
  });
  const directedEvents = await executor.all(
    "SELECT payload_json FROM event_outbox WHERE event_type = 'notification.requested'",
  );
  expect(directedEvents).toHaveLength(1);
  expect(readJson(directedEvents[0]?.payload_json)).toMatchObject({ targetSubscriptionId: "42" });
}

async function clearInfrastructureTables(executor: DatabaseAdapterExecutor): Promise<void> {
  for (const table of [
    "event_outbox",
    "queue_jobs",
    "scheduled_jobs",
    "log_entries",
    "cache_entries",
    "rate_limit_counters",
    "locks",
  ]) {
    await executor.run(`DELETE FROM ${table}`);
  }
}

function marker(executor: DatabaseAdapterExecutor, index: number): string {
  return executor.dialect === "postgresql" ? `$${index}` : "?";
}

function jsonPayload(value: unknown, executor: DatabaseAdapterExecutor): unknown {
  return executor.dialect === "sqlite" ? JSON.stringify(value) : value;
}

function getPostgresqlUrl(): string {
  if (!postgresqlUrl)
    throw new Error("TEST_DATABASE_URL is required for PostgreSQL adapter tests.");
  return postgresqlUrl;
}

function createPostgresqlTestExecutor(url: string): DatabaseAdapterExecutor {
  const pool = createPostgresqlPool(url);
  let activeClient: {
    query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
  } | null = null;

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
    },
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
    },
  };
}
