import {
  moduleAsyncMessageSchema,
  moduleExecutionContextSchema,
  type ModuleAsyncMessage,
  type ModuleExecutionContext,
} from "@web-admin-base/contracts";
import type { z } from "zod";

export function createModuleAsyncMessage<TPayload>(input: {
  context: ModuleExecutionContext;
  payload: TPayload;
  idempotencyKey: string;
  messageId: string;
  createdAt: Date;
  execution?: { timeoutSeconds: number; maxAttempts: number };
}): ModuleAsyncMessage<TPayload> {
  return moduleAsyncMessageSchema.parse({
    ...input,
    createdAt: input.createdAt.toISOString(),
  }) as ModuleAsyncMessage<TPayload>;
}

export function parseModuleAsyncMessage<TPayload>(
  value: unknown,
  payloadSchema: z.ZodType<TPayload>,
): ModuleAsyncMessage<TPayload> {
  const envelope = moduleAsyncMessageSchema.parse(value);
  return { ...envelope, payload: payloadSchema.parse(envelope.payload) };
}

export function createWorkerExecutionContext(
  context: ModuleExecutionContext,
): ModuleExecutionContext {
  return moduleExecutionContextSchema.parse({ ...context, source: "worker", sessionId: null });
}
