import { describe, expect, it } from "vitest";

import { moduleAsyncMessageSchema, moduleExecutionContextSchema } from "../src";

const context = {
  moduleCode: "fixture-orders",
  source: "api" as const,
  actorId: "7",
  organizationId: "3",
  sessionId: "11",
  requestId: "request-123",
  traceId: "trace-123",
  correlationId: "correlation-123",
  locale: "en",
};

describe("Business Module capability contracts", () => {
  it("accepts a complete serializable execution context", () => {
    expect(moduleExecutionContextSchema.parse(context)).toEqual(context);
  });

  it("rejects async messages that omit propagated context", () => {
    expect(() =>
      moduleAsyncMessageSchema.parse({
        messageId: "message-1",
        idempotencyKey: "order-export-1",
        payload: {},
        createdAt: new Date().toISOString(),
      }),
    ).toThrow();
  });
});
