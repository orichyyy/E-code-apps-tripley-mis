import type {
  BusinessApiModuleRegistration,
  BusinessModuleDefinition,
} from "@web-admin-base/contracts";
import type { z } from "zod";

import { capabilityDenied } from "./errors";

export function requireSchema(
  registration: BusinessApiModuleRegistration,
  schemaId: string,
): z.ZodType {
  return (
    registration.schemas[schemaId] ?? capabilityDenied(`Schema ${schemaId} is not registered.`)
  );
}

export function requireOwnedDefinition(
  definition: BusinessModuleDefinition,
  registration: BusinessApiModuleRegistration,
): void {
  if (registration.moduleCode !== definition.moduleCode) {
    capabilityDenied("Capability registration does not belong to the module definition.");
  }
}

export function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}
