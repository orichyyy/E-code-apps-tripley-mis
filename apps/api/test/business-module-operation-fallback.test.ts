import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { EventBusAdapter, QueueAdapter } from "@web-admin-base/adapters";
import { afterEach, describe, expect, it } from "vitest";

import { createDatabaseBusinessModuleCapabilityBindings } from "../src/business-modules/capabilities/database-capability.bindings";
import type { DatabaseBusinessModuleCapabilityRepository } from "../src/business-modules/capabilities/database-capability.repository";
import { InfrastructureServices } from "../src/modules/infrastructure/infrastructure.service";

const paths: string[] = [];

afterEach(async () => {
  await Promise.all(paths.splice(0).map((path) => rm(path, { force: true })));
});

describe("Business Module Operation Log fallback", () => {
  it("writes propagated context to a local JSONL file when QueueAdapter is unavailable", async () => {
    const path = join(tmpdir(), `module-operation-${process.pid}-${Date.now()}.jsonl`);
    paths.push(path);
    const bindings = createDatabaseBusinessModuleCapabilityBindings({
      repository: {} as DatabaseBusinessModuleCapabilityRepository,
      infrastructure: InfrastructureServices.inMemory(),
      queue: unavailableQueue(),
      eventBus: unusedEventBus(),
      hasPermission: async () => true,
      operationLogFallbackPath: path,
    });

    await bindings.operationEvents.record({
      context: {
        moduleCode: "fixture-operation",
        source: "api",
        actorId: "7",
        organizationId: "3",
        sessionId: "session-1",
        requestId: "request-1",
        traceId: "trace-1",
        correlationId: "correlation-1",
        locale: "en",
      },
      eventCode: "fixture-operation.updated",
      outcome: "failed",
      details: { reason: "conflict" },
    });

    expect(JSON.parse(await readFile(path, "utf8"))).toMatchObject({
      context: { traceId: "trace-1", correlationId: "correlation-1" },
      event: { eventCode: "fixture-operation.updated", outcome: "failed" },
    });
  });
});

function unavailableQueue(): QueueAdapter {
  return {
    enqueue: async () => {
      throw new Error("queue unavailable");
    },
    consume: async () => undefined,
    healthCheck: async () => ({ ok: false }),
  };
}

function unusedEventBus(): EventBusAdapter {
  return {
    publish: async () => undefined,
    subscribe: async () => undefined,
    healthCheck: async () => ({ ok: true }),
  };
}
