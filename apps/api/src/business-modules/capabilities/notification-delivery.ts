import type { BusinessModuleNotificationDelivery } from "./database-capability.bindings";
import type { InfrastructureServices } from "../../modules/infrastructure/infrastructure.service";

export function createBusinessModuleNotificationDelivery(
  infrastructure: InfrastructureServices,
): BusinessModuleNotificationDelivery {
  return async (input) => {
    const variables = primitiveVariables(input.payload);
    if (input.channel === "in_app") {
      await infrastructure.enqueueInAppNotification({
        templateCode: input.templateCode,
        locale: input.context.locale,
        audience: { type: "users", userIds: input.recipientUserIds },
        requestKey: `${input.context.moduleCode}:${input.eventType}:${input.idempotencyKey}`,
        variables,
        metadata: {
          moduleCode: input.context.moduleCode,
          eventType: input.eventType,
          correlationId: input.context.correlationId,
        },
        createdBy: input.context.actorId,
      });
      return;
    }
    await Promise.all(
      input.recipientUserIds.map((userId) =>
        infrastructure.requestEmailDelivery({
          requestKey: `${input.context.moduleCode}:${input.idempotencyKey}:${userId}`,
          userId,
          templateCode: input.templateCode,
          variables,
          referenceType: input.eventType,
          referenceId: input.messageId,
        }),
      ),
    );
  };
}

function primitiveVariables(value: unknown): Record<string, string | number | boolean | null> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const variables: Record<string, string | number | boolean | null> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item === null || ["string", "number", "boolean"].includes(typeof item)) {
      variables[key] = item as string | number | boolean | null;
    } else {
      throw new TypeError(`Notification template variable ${key} must be primitive.`);
    }
  }
  return variables;
}
