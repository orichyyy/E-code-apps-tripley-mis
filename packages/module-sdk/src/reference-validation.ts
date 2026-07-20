import type { BusinessModuleDefinition } from "@web-admin-base/contracts";

import { addError } from "./conformance-diagnostics";
import type { ConformanceDiagnostic } from "./conformance-types";

export function validateReferences(
  definition: BusinessModuleDefinition,
  diagnostics: ConformanceDiagnostic[],
  baseMenuCodes: readonly string[],
): void {
  const contributions = definition.contributions;
  const permissions = new Set(contributions.permissions.map(({ code }) => code));
  const routes = new Set(contributions.routes.map(({ routeCode }) => routeCode));
  const menus = new Set(contributions.menus.map(({ code }) => code));
  const operationEvents = new Set(contributions.operationEvents.map(({ code }) => code));
  const resources = new Set(contributions.dataResources.map(({ resourceType }) => resourceType));
  const missing = (kind: string, identifier: string, reference: string) =>
    addError(
      diagnostics,
      definition,
      { kind, identifier },
      "MODULE_REFERENCE_NOT_FOUND",
      `Reference ${reference} was not declared by ${definition.moduleCode}`,
    );

  for (const api of contributions.apis) {
    if (!permissions.has(api.requiredPermission)) missing("api", api.code, api.requiredPermission);
    if (api.method !== "GET" && !api.operationEventCode) {
      missing("api", api.code, "operationEventCode");
    }
    if (api.operationEventCode && !operationEvents.has(api.operationEventCode)) {
      missing("api", api.code, api.operationEventCode);
    }
  }
  for (const route of contributions.routes) {
    if (!permissions.has(route.requiredPermission)) {
      missing("route", route.routeCode, route.requiredPermission);
    }
  }
  for (const menu of contributions.menus) {
    if (menu.routeCode && !routes.has(menu.routeCode)) missing("menu", menu.code, menu.routeCode);
    if (menu.requiredPermission && !permissions.has(menu.requiredPermission)) {
      missing("menu", menu.code, menu.requiredPermission);
    }
    if (
      menu.parentCode &&
      !menus.has(menu.parentCode) &&
      !baseMenuCodes.includes(menu.parentCode)
    ) {
      missing("menu", menu.code, menu.parentCode);
    }
  }
  for (const field of contributions.fields) {
    if (!resources.has(field.resourceType)) {
      missing("field", `${field.resourceType}:${field.field}`, field.resourceType);
    }
  }
  for (const event of contributions.operationEvents) {
    if (!resources.has(event.resourceType))
      missing("operationEvent", event.code, event.resourceType);
  }
  for (const attachment of contributions.fileAttachments) {
    if (!resources.has(attachment.resourceType)) {
      missing("fileAttachment", attachment.attachmentCode, attachment.resourceType);
    }
  }
}
