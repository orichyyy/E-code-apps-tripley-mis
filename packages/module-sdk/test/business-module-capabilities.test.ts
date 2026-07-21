import { describe, expect, it, vi } from "vitest";

import type { ModuleCapabilityBindings } from "../src";
import {
  BusinessModuleCapabilityError,
  BusinessModuleDeclaredError,
  createBusinessModuleCapabilities,
  encodeBusinessCsv,
} from "../src";
import {
  capabilityApiRegistration,
  capabilityContext,
  capabilityModule,
} from "./fixtures/capability-business-module";

function createBindings() {
  const events: unknown[] = [];
  const binding: ModuleCapabilityBindings = {
    permissions: { has: async (code) => code.endsWith(":view") },
    operationEvents: { record: async (input) => void events.push(input) },
    files: {
      get: async (id) => ({ id, extension: "pdf", sizeBytes: 512, status: "active" }),
      attach: async (input) => ({
        id: "21",
        fileId: input.fileId,
        attachmentCode: input.attachmentCode,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        status: "active",
        createdAt: "2026-07-21T00:00:00.000Z",
      }),
      detach: async (input) => void events.push(input),
    },
    csv: {
      createTask: async (input) => ({
        id: "31",
        taskType: input.taskType,
        resourceType: input.resourceType,
        status: "pending",
      }),
    },
    domainEvents: { publish: async (input) => void events.push(input) },
    notifications: { publish: async (input) => void events.push(input) },
    jobs: { enqueue: async (input) => (events.push(input), { id: "41" }) },
  };
  return { binding, events };
}

function createRuntime(bindings = createBindings().binding) {
  return createBusinessModuleCapabilities({
    definition: capabilityModule,
    apiRegistration: capabilityApiRegistration,
    context: capabilityContext,
    bindings,
    now: () => new Date("2026-07-21T00:00:00.000Z"),
    nextId: () => "message-1",
  });
}

describe("Business Module capability runtime", () => {
  it("masks operation details and enforces declared permissions", async () => {
    const { binding, events } = createBindings();
    const runtime = createRuntime(binding);
    await runtime.permissions.require("fixture-capabilities.record:view");
    await runtime.operations.record({
      eventCode: "fixture-capabilities.record-updated",
      outcome: "succeeded",
      details: { name: "visible", secret: "private" },
    });

    expect(events[0]).toMatchObject({
      details: { name: "visible", secret: "[MASKED]" },
      context: { correlationId: "correlation-123" },
    });
    await expect(runtime.permissions.require("fixture-capabilities.record:data")).rejects.toThrow(
      BusinessModuleCapabilityError,
    );
  });

  it("authorizes and constrains Managed File references", async () => {
    const { binding } = createBindings();
    const attach = vi.spyOn(binding.files, "attach");
    const runtime = createRuntime(binding);

    await expect(runtime.files.attach("fixture-capabilities.document", "9", "5")).resolves.toEqual(
      expect.objectContaining({ id: "21", fileId: "5" }),
    );
    expect(attach).toHaveBeenCalledWith(
      expect.objectContaining({ cardinality: "single", resourceId: "9" }),
    );
  });

  it("publishes CSV tasks with explicit fields and formula-safe output", async () => {
    const { binding } = createBindings();
    const createTask = vi.spyOn(binding.csv, "createTask");
    const runtime = createRuntime(binding);

    await runtime.csv.createExport("fixture-capabilities:records", "export-1", { active: true });
    expect(createTask).toHaveBeenCalledWith(
      expect.objectContaining({ exportFields: ["name"], filters: { active: true } }),
    );
    expect(encodeBusinessCsv([{ name: "=1+1", ignored: "secret" }], ["name"])).toBe("name\n'=1+1");
  });

  it("validates and propagates domain, notification, and job messages", async () => {
    const { binding, events } = createBindings();
    const runtime = createRuntime(binding);

    await runtime.domainEvents.publish("fixture-capabilities.record-changed", "domain-1", {
      recordId: "9",
    });
    await runtime.notifications.publish({
      eventType: "fixture-capabilities.record-notice",
      idempotencyKey: "notice-1",
      payload: { recordId: "9" },
      channels: ["in_app"],
    });
    await runtime.jobs.enqueue({
      jobType: "fixture-capabilities.reconcile",
      idempotencyKey: "job-1",
      payload: { batchSize: 20 },
    });

    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({ message: { context: capabilityContext } });
    expect(events[1]).toMatchObject({ recipientUserIds: ["7", "8"], channels: ["in_app"] });
    expect(events[2]).toMatchObject({ timeoutSeconds: 30, maxAttempts: 2 });
  });

  it("creates only declared typed errors with schema-safe details", () => {
    const runtime = createRuntime();
    const error = runtime.errors.create("BUSINESS_FIXTURE_CAPABILITIES_CONFLICT", {
      recordId: "9",
    });

    expect(error).toBeInstanceOf(BusinessModuleDeclaredError);
    expect(error).toMatchObject({ status: 409, details: { recordId: "9" } });
    expect(() => runtime.errors.create("BUSINESS_FIXTURE_CAPABILITIES_UNKNOWN")).toThrow(
      BusinessModuleCapabilityError,
    );
  });
});
