import type {
  BusinessApiModuleRegistration,
  BusinessModuleDefinition,
  ModuleExecutionContext,
} from "@web-admin-base/contracts";
import {
  createDatabaseEventBusAdapter,
  type DatabaseAdapterExecutor,
  type QueueAdapter,
} from "@web-admin-base/adapters";
import {
  createBusinessModuleCapabilities,
  type ModuleCapabilityBindings,
} from "@web-admin-base/module-sdk";

import type { BackendCoreServices } from "../../modules/core-foundation/services";
import type { InfrastructureServices } from "../../modules/infrastructure/infrastructure.service";
import { createDatabaseBusinessModuleCapabilityBindings } from "./database-capability.bindings";
import { DatabaseBusinessModuleCapabilityRepository } from "./database-capability.repository";
import { createBusinessModuleNotificationDelivery } from "./notification-delivery";

export type BusinessModuleCapabilityFactory = {
  create: (
    definition: BusinessModuleDefinition,
    registration: BusinessApiModuleRegistration,
    context: ModuleExecutionContext,
  ) => ReturnType<typeof createBusinessModuleCapabilities>;
};

export function createBusinessModuleCapabilityFactory(
  bindings: ModuleCapabilityBindings,
): BusinessModuleCapabilityFactory {
  return {
    create(definition, registration, context) {
      return createBusinessModuleCapabilities({
        definition,
        apiRegistration: registration,
        context,
        bindings,
      });
    },
  };
}

export function createDatabaseBusinessModuleCapabilityFactory(options: {
  backend: BackendCoreServices;
  executor: DatabaseAdapterExecutor;
  infrastructure: InfrastructureServices;
  queue: QueueAdapter;
}): BusinessModuleCapabilityFactory {
  return createBusinessModuleCapabilityFactory(
    createDatabaseBusinessModuleCapabilityBindings({
      repository: new DatabaseBusinessModuleCapabilityRepository(options.executor),
      infrastructure: options.infrastructure,
      queue: options.queue,
      eventBus: createDatabaseEventBusAdapter(options.executor),
      hasPermission: (permissionCode, context) =>
        context.actorId
          ? options.backend.hasPermission(
              context.actorId,
              context.organizationId ?? "",
              permissionCode,
            )
          : false,
      deliverNotification: createBusinessModuleNotificationDelivery(options.infrastructure),
    }),
  );
}
