import type { BusinessModuleDefinition } from "@web-admin-base/contracts";

import { addError } from "./conformance-diagnostics";
import type { ConformanceDiagnostic } from "./conformance-types";

export function validateReferences(
  definition: BusinessModuleDefinition,
  diagnostics: ConformanceDiagnostic[],
  baseMenuCodes: readonly string[],
): void {
  const contributions = definition.contributions;
  const permissions = new Map(
    contributions.permissions.map((permission) => [permission.code, permission]),
  );
  const routes = new Set(contributions.routes.map(({ routeCode }) => routeCode));
  const menus = new Set(contributions.menus.map(({ code }) => code));
  const operationEvents = new Set(contributions.operationEvents.map(({ code }) => code));
  const resources = new Map(
    contributions.dataResources.map((resource) => [resource.resourceType, resource]),
  );
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
    if (api.resourceAccess && !resources.has(api.resourceAccess.resourceType)) {
      missing("api", api.code, api.resourceAccess.resourceType);
    }
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
      continue;
    }
    const resource = resources.get(field.resourceType)!;
    if (!resource.fields.some(({ code }) => code === field.field)) {
      addError(
        diagnostics,
        definition,
        { kind: "field", identifier: `${field.resourceType}:${field.field}` },
        "MODULE_RESOURCE_FIELD_NOT_FOUND",
        `Field ${field.field} was not declared by resource ${field.resourceType}`,
      );
    }
  }
  for (const resource of resources.values()) {
    const permission = permissions.get(resource.permissionCode);
    if (permission?.permissionType !== "data") {
      addError(
        diagnostics,
        definition,
        { kind: "dataResource", identifier: resource.resourceType },
        "MODULE_DATA_PERMISSION_INVALID",
        `Resource permission ${resource.permissionCode} must reference a declared data permission`,
      );
    }
    const fields = new Set(resource.fields.map(({ code }) => code));
    for (const field of [resource.ownerUserField, resource.organizationField]) {
      if (field && !fields.has(field)) {
        addError(
          diagnostics,
          definition,
          { kind: "dataResource", identifier: resource.resourceType },
          "MODULE_RESOURCE_FIELD_NOT_FOUND",
          `Resource context field ${field} was not declared by ${resource.resourceType}`,
        );
      }
    }
    if (resource.accessModel === "global" && resource.operatorCodes.length > 0) {
      addError(
        diagnostics,
        definition,
        { kind: "dataResource", identifier: resource.resourceType },
        "MODULE_GLOBAL_RESOURCE_OPERATOR_INVALID",
        "Global resources cannot declare data permission operators",
      );
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
