import type { BusinessModuleDefinition } from "@web-admin-base/contracts";

import { requirePrefix } from "./conformance-diagnostics";
import { definitionIdentities, localizedDescriptors } from "./contribution-identities";
import type { ConformanceDiagnostic } from "./conformance-types";

export function validateNamespaces(
  definition: BusinessModuleDefinition,
  diagnostics: ConformanceDiagnostic[],
): void {
  const modulePrefix = `${definition.moduleCode}.`;
  const i18nPrefix = `modules.${definition.moduleCode}.`;
  for (const contribution of definitionIdentities(definition)) {
    const prefix = identityPrefix(
      definition.moduleCode,
      contribution.kind,
      modulePrefix,
      i18nPrefix,
    );
    if (prefix)
      requirePrefix(diagnostics, definition, contribution, contribution.identifier, prefix);
  }
  for (const api of definition.contributions.apis) {
    requirePrefix(
      diagnostics,
      definition,
      { kind: "api", identifier: api.code },
      api.path,
      `/api/modules/${definition.moduleCode}/`,
    );
  }
  for (const route of definition.contributions.routes) {
    requirePrefix(
      diagnostics,
      definition,
      { kind: "route", identifier: route.routeCode },
      route.path,
      `/modules/${definition.moduleCode}/`,
    );
  }
  for (const menu of definition.contributions.menus) {
    requirePrefix(
      diagnostics,
      definition,
      { kind: "menu", identifier: menu.code },
      menu.path,
      `/modules/${definition.moduleCode}/`,
    );
  }
  for (const descriptor of localizedDescriptors(definition)) {
    requirePrefix(
      diagnostics,
      definition,
      { kind: "localizedMessage", identifier: descriptor.key },
      descriptor.key,
      i18nPrefix,
    );
  }
}

function identityPrefix(
  moduleCode: string,
  kind: string,
  modulePrefix: string,
  i18nPrefix: string,
): string | undefined {
  if (kind === "permission") return modulePrefix;
  if (kind === "api") return `api.${modulePrefix}`;
  if (kind === "importExportResource") return `${moduleCode}:`;
  if (kind === "i18nMessage") return i18nPrefix;
  if (kind === "error") return `BUSINESS_${moduleCode.replaceAll("-", "_").toUpperCase()}_`;
  return kind === "field" ? undefined : modulePrefix;
}
