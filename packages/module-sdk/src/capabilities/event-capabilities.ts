import type {
  BusinessApiModuleRegistration,
  BusinessModuleDefinition,
  ModuleExecutionContext,
  ModuleOperationEventInput,
} from "@web-admin-base/contracts";

import { createModuleAsyncMessage } from "./async-message";
import { capabilityDenied } from "./errors";
import { requireSchema, uniqueIds } from "./shared";
import type { ModuleCapabilityBindings } from "./types";

type AsyncDependencies = {
  context: ModuleExecutionContext;
  now: () => Date;
  nextId: () => string;
};

export function createOperationEventCapability(input: {
  definition: BusinessModuleDefinition;
  context: ModuleExecutionContext;
  binding: ModuleCapabilityBindings["operationEvents"];
}) {
  return {
    async record(event: ModuleOperationEventInput) {
      const declaration = input.definition.contributions.operationEvents.find(
        ({ code }) => code === event.eventCode,
      );
      if (!declaration) capabilityDenied(`Operation Event ${event.eventCode} is not declared.`);
      const sensitive = new Set(declaration.sensitiveFields);
      const details = Object.fromEntries(
        Object.entries(event.details).map(([key, value]) => [
          key,
          sensitive.has(key) ? "[MASKED]" : value,
        ]),
      );
      await input.binding.record({ ...event, details, context: input.context });
    },
  };
}

export function createDomainEventCapability(
  input: AsyncDependencies & {
    definition: BusinessModuleDefinition;
    registration: BusinessApiModuleRegistration;
    binding: ModuleCapabilityBindings["domainEvents"];
  },
) {
  return {
    async publish(eventType: string, idempotencyKey: string, payload: unknown) {
      const declaration = input.definition.contributions.domainEvents.find(
        (item) => item.eventType === eventType,
      );
      if (!declaration) capabilityDenied(`Domain Event ${eventType} is not declared.`);
      const parsed = requireSchema(input.registration, declaration.payloadSchemaId).parse(payload);
      await input.binding.publish({
        eventType,
        message: createModuleAsyncMessage({
          context: input.context,
          payload: parsed,
          idempotencyKey,
          messageId: input.nextId(),
          createdAt: input.now(),
        }),
      });
    },
  };
}

export function createNotificationCapability(
  input: AsyncDependencies & {
    definition: BusinessModuleDefinition;
    registration: BusinessApiModuleRegistration;
    binding: ModuleCapabilityBindings["notifications"];
  },
) {
  return {
    async publish(options: {
      eventType: string;
      idempotencyKey: string;
      payload: unknown;
      channels?: Array<"in_app" | "email" | "webhook">;
    }) {
      const declaration = input.definition.contributions.notificationEvents.find(
        ({ eventType }) => eventType === options.eventType,
      );
      if (!declaration) {
        capabilityDenied(`Notification Event ${options.eventType} is not declared.`);
      }
      const channels = options.channels ?? declaration.channels;
      if (channels.some((channel) => !declaration.channels.includes(channel))) {
        capabilityDenied("Notification channel is not declared for this event.");
      }
      const payload = requireSchema(input.registration, declaration.payloadSchemaId).parse(
        options.payload,
      );
      const resolver = input.registration.notificationRecipientResolvers[options.eventType];
      if (!resolver) capabilityDenied(`Recipient resolver for ${options.eventType} is missing.`);
      const recipientUserIds = uniqueIds(await resolver(payload, input.context));
      if (recipientUserIds.length === 0) capabilityDenied("Notification has no recipients.");
      await input.binding.publish({
        eventType: options.eventType,
        recipientUserIds,
        channels,
        templateCodes: declaration.templateCodes,
        message: createModuleAsyncMessage({
          context: input.context,
          payload,
          idempotencyKey: options.idempotencyKey,
          messageId: input.nextId(),
          createdAt: input.now(),
        }),
      });
    },
  };
}
