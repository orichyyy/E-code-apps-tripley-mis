import type {
  BusinessApiModuleRegistration,
  BusinessModuleDefinition,
  ModuleExecutionContext,
} from "@web-admin-base/contracts";

import { createModuleAsyncMessage } from "./async-message";
import { capabilityDenied } from "./errors";
import { requireSchema } from "./shared";
import type { ModuleCapabilityBindings } from "./types";

export function createJobCapability(input: {
  definition: BusinessModuleDefinition;
  registration: BusinessApiModuleRegistration;
  context: ModuleExecutionContext;
  binding: ModuleCapabilityBindings["jobs"];
  now: () => Date;
  nextId: () => string;
}) {
  return {
    async enqueue(options: {
      jobType: string;
      idempotencyKey: string;
      payload: unknown;
      timeoutSeconds?: number;
      maxAttempts?: number;
    }) {
      const declaration = input.definition.contributions.scheduledJobs.find(
        ({ jobType }) => jobType === options.jobType,
      );
      if (!declaration) capabilityDenied(`Job ${options.jobType} is not declared.`);
      const timeoutSeconds = options.timeoutSeconds ?? declaration.defaultTimeoutSeconds;
      const maxAttempts = options.maxAttempts ?? declaration.defaultMaxAttempts;
      if (timeoutSeconds > declaration.maxTimeoutSeconds || maxAttempts > declaration.maxAttempts) {
        capabilityDenied(`Job ${options.jobType} exceeds its declared execution bounds.`);
      }
      const payload = requireSchema(input.registration, declaration.parameterSchemaId).parse(
        options.payload,
      );
      return input.binding.enqueue({
        jobType: options.jobType,
        timeoutSeconds,
        maxAttempts,
        message: createModuleAsyncMessage({
          context: input.context,
          payload,
          idempotencyKey: options.idempotencyKey,
          messageId: input.nextId(),
          createdAt: input.now(),
          execution: { timeoutSeconds, maxAttempts },
        }),
      });
    },
  };
}
