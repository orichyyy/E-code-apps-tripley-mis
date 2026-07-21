import { existsSync, rmSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createDatabaseEventBusAdapter,
  createDatabaseQueueAdapter,
  createLocalFileStorageAdapter,
  type DatabaseAdapterExecutor,
} from "@web-admin-base/adapters";
import type { ModuleAsyncMessage, ModuleExecutionContext } from "@web-admin-base/contracts";
import { runPostgresqlMigrations, runSqliteMigrations } from "@web-admin-base/db";
import { afterEach, describe, expect, it } from "vitest";

import { createDatabaseBusinessModuleCapabilityBindings } from "../src/business-modules/capabilities/database-capability.bindings";
import { DatabaseBusinessModuleCapabilityRepository } from "../src/business-modules/capabilities/database-capability.repository";
import {
  createPostgresqlInfrastructureExecutor,
  createSqliteInfrastructureExecutor,
} from "../src/modules/infrastructure/infrastructure.executor";
import { InfrastructureRepository } from "../src/modules/infrastructure/infrastructure.repository";
import { InfrastructureServices } from "../src/modules/infrastructure/infrastructure.service";

const postgresqlUrl = process.env.TEST_DATABASE_URL;
const sqliteFiles: string[] = [];

afterEach(() => {
  for (const filename of sqliteFiles.splice(0)) {
    if (existsSync(filename)) rmSync(filename, { force: true });
  }
});

describe("Business Module durable capability bindings", () => {
  it("persists capability effects in SQLite", async () => {
    const filename = join(tmpdir(), `module-capabilities-${process.pid}-${Date.now()}.sqlite`);
    sqliteFiles.push(filename);
    runSqliteMigrations({ url: `file:${filename}` });
    const executor = createSqliteInfrastructureExecutor(filename);
    await runPersistenceScenario(executor);
  });

  it.runIf(postgresqlUrl)("persists capability effects in PostgreSQL", async () => {
    await runPostgresqlMigrations({ url: postgresqlUrl! });
    const executor = createPostgresqlInfrastructureExecutor(postgresqlUrl!);
    await clearTables(executor);
    await runPersistenceScenario(executor);
  });
});

async function runPersistenceScenario(executor: DatabaseAdapterExecutor): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "module-capability-files-"));
  const storage = createLocalFileStorageAdapter({ rootDirectory: root });
  const queue = createDatabaseQueueAdapter(executor);
  const infrastructure = InfrastructureServices.database(new InfrastructureRepository(executor), {
    storage,
    queue,
  });
  const repository = new DatabaseBusinessModuleCapabilityRepository(executor);
  const bindings = createDatabaseBusinessModuleCapabilityBindings({
    repository,
    infrastructure,
    queue,
    eventBus: createDatabaseEventBusAdapter(executor),
    hasPermission: async () => true,
  });
  try {
    const fileId = await insertManagedFile(executor);
    const context = executionContext();
    const message = asyncMessage(context);

    const reference = await bindings.files.attach({
      context,
      fileId,
      resourceId: "91",
      resourceType: "fixture-capabilities.record",
      attachmentCode: "fixture-capabilities.document",
      cardinality: "single",
    });
    const firstTask = await bindings.csv.createTask({
      message,
      taskType: "export",
      resourceType: "fixture-capabilities:records",
      filters: { active: true },
      exportFields: ["name"],
    });
    const duplicateTask = await bindings.csv.createTask({
      message,
      taskType: "export",
      resourceType: "fixture-capabilities:records",
      filters: { active: true },
      exportFields: ["name"],
    });
    await bindings.domainEvents.publish({ eventType: "fixture-capabilities.changed", message });
    await bindings.domainEvents.publish({ eventType: "fixture-capabilities.changed", message });
    await bindings.operationEvents.record({
      context,
      eventCode: "fixture-capabilities.updated",
      outcome: "succeeded",
      details: {},
    });
    await bindings.jobs.enqueue({
      jobType: "fixture-capabilities.reconcile",
      message: { ...message, idempotencyKey: "job-1" },
      timeoutSeconds: 30,
      maxAttempts: 2,
    });

    const outbox = await executor.all(
      "SELECT event_key, payload_json FROM event_outbox WHERE event_type = 'fixture-capabilities.changed'",
    );
    const jobs = await executor.all(
      "SELECT type, max_attempts, payload_json FROM queue_jobs ORDER BY id",
    );
    const tasks = await executor.all(
      "SELECT id, execution_context_json FROM import_export_tasks WHERE resource_type = 'fixture-capabilities:records'",
    );
    expect(reference).toMatchObject({ fileId, resourceId: "91", status: "active" });
    expect(firstTask.id).toBe(duplicateTask.id);
    expect(outbox).toHaveLength(1);
    expect(tasks).toHaveLength(1);
    expect(readJson(tasks[0]!.execution_context_json)).toMatchObject({
      correlationId: "correlation-123",
      organizationId: "3",
    });
    expect(jobs.map((row) => String(row.type))).toEqual(
      expect.arrayContaining([
        "business-module.operation-log.write",
        "fixture-capabilities.reconcile",
      ]),
    );
    expect(
      Number(jobs.find((row) => row.type === "fixture-capabilities.reconcile")?.max_attempts),
    ).toBe(2);
  } finally {
    await infrastructure.close();
    await rm(root, { recursive: true, force: true });
  }
}

async function insertManagedFile(executor: DatabaseAdapterExecutor): Promise<string> {
  const timestamp = new Date().toISOString();
  const key = `test/${Date.now()}-${Math.random()}.pdf`;
  const p = (index: number) => (executor.dialect === "postgresql" ? `$${index}` : "?");
  await executor.run(
    `INSERT INTO file_objects
      (object_key, original_name, content_type, extension, size_bytes, storage_driver,
       status, referenced, is_deleted, created_at, updated_at)
     VALUES (${p(1)}, 'document.pdf', 'application/pdf', 'pdf', 10, 'local', 'active',
      ${executor.dialect === "postgresql" ? "FALSE" : "0"},
      ${executor.dialect === "postgresql" ? "FALSE" : "0"}, ${p(2)}, ${p(3)})`,
    [key, timestamp, timestamp],
  );
  const rows = await executor.all(`SELECT id FROM file_objects WHERE object_key = ${p(1)}`, [key]);
  return String(rows[0]!.id);
}

function executionContext(): ModuleExecutionContext {
  return {
    moduleCode: "fixture-capabilities",
    source: "api",
    actorId: null,
    organizationId: "3",
    sessionId: null,
    requestId: "request-123",
    traceId: "trace-123",
    correlationId: "correlation-123",
    locale: "en",
  };
}

function asyncMessage(context: ModuleExecutionContext): ModuleAsyncMessage {
  return {
    messageId: "message-1",
    idempotencyKey: "export-1",
    context,
    payload: { filters: { active: true } },
    createdAt: new Date().toISOString(),
  };
}

async function clearTables(executor: DatabaseAdapterExecutor): Promise<void> {
  await executor.run(
    "DELETE FROM queue_jobs; DELETE FROM event_outbox; DELETE FROM import_export_tasks; DELETE FROM file_references; DELETE FROM file_objects;",
  );
}

function readJson(value: unknown): Record<string, unknown> {
  return typeof value === "string"
    ? (JSON.parse(value) as Record<string, unknown>)
    : (value as Record<string, unknown>);
}
