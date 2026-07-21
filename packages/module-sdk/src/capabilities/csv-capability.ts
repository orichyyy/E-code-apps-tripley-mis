import type {
  BusinessApiModuleRegistration,
  BusinessModuleDefinition,
  ModuleExecutionContext,
} from "@web-admin-base/contracts";

import { createModuleAsyncMessage } from "./async-message";
import { capabilityDenied } from "./errors";
import type { ModuleCapabilityBindings } from "./types";

export function createCsvCapability(input: {
  definition: BusinessModuleDefinition;
  registration: BusinessApiModuleRegistration;
  context: ModuleExecutionContext;
  binding: ModuleCapabilityBindings["csv"];
  now: () => Date;
  nextId: () => string;
}) {
  const requireResource = (resourceType: string, capability: "import" | "export") => {
    const declaration = input.definition.contributions.importExportResources.find(
      (item) => item.resourceType === resourceType,
    );
    if (!declaration || !declaration.capabilities.includes(capability)) {
      capabilityDenied(`${capability} is not declared for ${resourceType}.`);
    }
    const registration = input.registration.importExportResources[resourceType];
    if (!registration) capabilityDenied(`CSV API registration for ${resourceType} is missing.`);
    return { declaration, registration };
  };

  const message = (idempotencyKey: string, payload: unknown) =>
    createModuleAsyncMessage({
      context: input.context,
      payload,
      idempotencyKey,
      messageId: input.nextId(),
      createdAt: input.now(),
    });

  return {
    async createExport(resourceType: string, idempotencyKey: string, filters: unknown) {
      const { declaration, registration } = requireResource(resourceType, "export");
      const normalized = registration.normalizeExportFilters
        ? await registration.normalizeExportFilters(filters, input.context)
        : {};
      return input.binding.createTask({
        message: message(idempotencyKey, { filters: normalized }),
        taskType: "export",
        resourceType,
        filters: normalized,
        exportFields: declaration.exportFields,
      });
    },
    async previewImport(resourceType: string, fileId: string) {
      const { registration } = requireResource(resourceType, "import");
      if (!registration.previewImport) {
        capabilityDenied(`Import preview for ${resourceType} is missing.`);
      }
      return registration.previewImport(fileId, input.context);
    },
    async createImport(resourceType: string, idempotencyKey: string, fileId: string) {
      const { declaration, registration } = requireResource(resourceType, "import");
      if (!registration.previewImport) {
        capabilityDenied(`Import preview for ${resourceType} is missing.`);
      }
      const preview = await registration.previewImport(fileId, input.context);
      if (!preview.valid) capabilityDenied("Import preview contains validation errors.");
      return input.binding.createTask({
        message: message(idempotencyKey, { fileId }),
        taskType: "import",
        resourceType,
        fileId,
        exportFields: declaration.exportFields,
      });
    },
  };
}

export function encodeBusinessCsv(rows: Array<Record<string, unknown>>, fields: string[]): string {
  return [
    fields.map(csvCell).join(","),
    ...rows.map((row) => fields.map((field) => csvCell(row[field])).join(",")),
  ].join("\n");
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
