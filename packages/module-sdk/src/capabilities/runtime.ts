import { randomUUID } from "node:crypto";

import { moduleExecutionContextSchema } from "@web-admin-base/contracts";

import { createCsvCapability } from "./csv-capability";
import { BusinessModuleDeclaredError, capabilityDenied } from "./errors";
import {
  createDomainEventCapability,
  createNotificationCapability,
  createOperationEventCapability,
} from "./event-capabilities";
import { createFileCapability } from "./file-capability";
import { createJobCapability } from "./job-capability";
import { requireOwnedDefinition, requireSchema } from "./shared";
import type { BusinessModuleCapabilityOptions } from "./types";

export function createBusinessModuleCapabilities(options: BusinessModuleCapabilityOptions) {
  requireOwnedDefinition(options.definition, options.apiRegistration);
  const context = moduleExecutionContextSchema.parse(options.context);
  if (context.moduleCode !== options.definition.moduleCode) {
    capabilityDenied("Execution context does not belong to the module definition.");
  }
  const now = options.now ?? (() => new Date());
  const nextId = options.nextId ?? randomUUID;
  const shared = {
    definition: options.definition,
    registration: options.apiRegistration,
    context,
    now,
    nextId,
  };

  return {
    context,
    clock: { now },
    ids: { serialize: serializeId, next: nextId },
    permissions: {
      async has(permissionCode: string) {
        assertDeclaredPermission(options, permissionCode);
        return options.bindings.permissions.has(permissionCode, context);
      },
      async require(permissionCode: string) {
        assertDeclaredPermission(options, permissionCode);
        if (!(await options.bindings.permissions.has(permissionCode, context))) {
          capabilityDenied(`Permission ${permissionCode} was denied.`);
        }
      },
    },
    operations: createOperationEventCapability({
      definition: options.definition,
      context,
      binding: options.bindings.operationEvents,
    }),
    files: createFileCapability({
      definition: options.definition,
      registration: options.apiRegistration,
      context,
      binding: options.bindings.files,
    }),
    csv: createCsvCapability({ ...shared, binding: options.bindings.csv }),
    domainEvents: createDomainEventCapability({
      ...shared,
      binding: options.bindings.domainEvents,
    }),
    notifications: createNotificationCapability({
      ...shared,
      binding: options.bindings.notifications,
    }),
    jobs: createJobCapability({ ...shared, binding: options.bindings.jobs }),
    errors: {
      create(code: string, details?: unknown) {
        const declaration = options.definition.contributions.errors.find(
          (item) => item.code === code,
        );
        if (!declaration) capabilityDenied(`Error ${code} is not declared.`);
        const safeDetails = declaration.detailsSchemaId
          ? requireSchema(options.apiRegistration, declaration.detailsSchemaId).parse(details)
          : undefined;
        return new BusinessModuleDeclaredError(
          declaration.code,
          declaration.status,
          declaration.message,
          safeDetails,
        );
      },
    },
  };
}

function assertDeclaredPermission(
  options: BusinessModuleCapabilityOptions,
  permissionCode: string,
): void {
  if (!options.definition.contributions.permissions.some(({ code }) => code === permissionCode)) {
    capabilityDenied(`Permission ${permissionCode} is not declared.`);
  }
}

function serializeId(value: string | number | bigint): string {
  if (typeof value === "string") {
    if (!/^\d+$/.test(value)) throw new TypeError("ID strings must contain decimal digits only.");
    return value;
  }
  if (typeof value === "number" && (!Number.isSafeInteger(value) || value < 0)) {
    throw new TypeError("Numeric IDs must be non-negative safe integers.");
  }
  if (typeof value === "bigint" && value < 0n) {
    throw new TypeError("BigInt IDs must be non-negative.");
  }
  return String(value);
}
