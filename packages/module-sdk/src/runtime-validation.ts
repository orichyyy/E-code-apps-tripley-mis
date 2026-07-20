import type { BusinessModuleDefinition } from "@web-admin-base/contracts";

import { addError } from "./conformance-diagnostics";
import type { BusinessModuleConformanceInput, ConformanceDiagnostic } from "./conformance-types";

export function validateRuntime(
  input: BusinessModuleConformanceInput,
  diagnostics: ConformanceDiagnostic[],
): void {
  const definitionsByCode = new Map(input.definitions.map((item) => [item.moduleCode, item]));
  validateDeclaredRuntime(input, diagnostics);
  validateRegisteredRuntime(input, definitionsByCode, diagnostics);
  validateMountedRuntime(input, diagnostics);
  validateRegistrationOwners(input, definitionsByCode, diagnostics);
}

function validateDeclaredRuntime(
  input: BusinessModuleConformanceInput,
  diagnostics: ConformanceDiagnostic[],
): void {
  const mountedApis = new Set(
    input.runtime.mountedApiRoutes.map(({ method, path }) => routeKey(method, path)),
  );
  const tanstackRoutes = new Set(input.runtime.tanstackRoutePaths);
  for (const definition of input.definitions) {
    const apiRegistration = input.runtime.apiModules.find(matchesModule(definition));
    const webRegistration = input.runtime.webModules.find(matchesModule(definition));
    const workerRegistration = input.runtime.workerModules.find(matchesModule(definition));
    for (const api of definition.contributions.apis) {
      const matches = apiRegistration?.routes.some(
        (route) =>
          route.code === api.code &&
          routeKey(route.method, route.path) === routeKey(api.method, api.path),
      );
      if (!matches) runtimeError(diagnostics, definition, "api", api.code, "API");
      if (!mountedApis.has(routeKey(api.method, api.path))) {
        addError(
          diagnostics,
          definition,
          { kind: "api", identifier: api.code },
          "MODULE_API_ROUTE_NOT_MOUNTED",
          "Declared API is not mounted in the Hono route tree",
        );
      }
    }
    for (const route of definition.contributions.routes) {
      const matches = webRegistration?.routes.some(
        (entry) => entry.routeCode === route.routeCode && entry.path === route.path,
      );
      if (!matches) runtimeError(diagnostics, definition, "route", route.routeCode, "Web");
      if (!tanstackRoutes.has(route.path)) {
        addError(
          diagnostics,
          definition,
          { kind: "route", identifier: route.routeCode },
          "MODULE_WEB_ROUTE_NOT_MOUNTED",
          "Declared route is not present in the TanStack route tree",
        );
      }
    }
    validateDeclaredWorker(definition, workerRegistration, diagnostics);
    validateDeclaredOperators(definition, apiRegistration, diagnostics);
  }
}

function validateDeclaredOperators(
  definition: BusinessModuleDefinition,
  registration: BusinessModuleConformanceInput["runtime"]["apiModules"][number] | undefined,
  diagnostics: ConformanceDiagnostic[],
): void {
  const declared = new Set(
    definition.contributions.dataResources.flatMap(({ operatorCodes }) => operatorCodes),
  );
  const registered = new Set(Object.keys(registration?.dataPermissionOperators ?? {}));
  for (const operatorCode of declared) {
    if (!registered.has(operatorCode)) {
      runtimeError(diagnostics, definition, "dataPermissionOperator", operatorCode, "api_operator");
    }
  }
  for (const operatorCode of registered) {
    if (!declared.has(operatorCode)) {
      runtimeError(diagnostics, definition, "dataPermissionOperator", operatorCode, "api_operator");
    }
  }
}

function validateDeclaredWorker(
  definition: BusinessModuleDefinition,
  registration: BusinessModuleConformanceInput["runtime"]["workerModules"][number] | undefined,
  diagnostics: ConformanceDiagnostic[],
): void {
  for (const job of definition.contributions.scheduledJobs) {
    if (!registration?.jobTypes.includes(job.jobType)) {
      runtimeError(diagnostics, definition, "scheduledJob", job.jobType, "Worker");
    }
  }
  for (const resource of definition.contributions.importExportResources) {
    if (!registration?.importExportResourceTypes.includes(resource.resourceType)) {
      runtimeError(
        diagnostics,
        definition,
        "importExportResource",
        resource.resourceType,
        "Worker",
      );
    }
  }
}

function validateRegisteredRuntime(
  input: BusinessModuleConformanceInput,
  definitions: Map<string, BusinessModuleDefinition>,
  diagnostics: ConformanceDiagnostic[],
): void {
  for (const registration of input.runtime.apiModules) {
    const definition = definitions.get(registration.moduleCode);
    if (!definition) continue;
    for (const route of registration.routes) {
      const matches = definition.contributions.apis.some(
        ({ code, method, path }) =>
          code === route.code && routeKey(method, path) === routeKey(route.method, route.path),
      );
      if (!matches) runtimeError(diagnostics, definition, "api", route.code, "API");
    }
  }
  for (const registration of input.runtime.webModules) {
    const definition = definitions.get(registration.moduleCode);
    if (!definition) continue;
    for (const route of registration.routes) {
      const matches = definition.contributions.routes.some(
        ({ routeCode, path }) => routeCode === route.routeCode && path === route.path,
      );
      if (!matches) runtimeError(diagnostics, definition, "route", route.routeCode, "Web");
    }
  }
  for (const registration of input.runtime.workerModules) {
    const definition = definitions.get(registration.moduleCode);
    if (definition) validateRegisteredWorker(definition, registration, diagnostics);
  }
}

function validateRegisteredWorker(
  definition: BusinessModuleDefinition,
  registration: BusinessModuleConformanceInput["runtime"]["workerModules"][number],
  diagnostics: ConformanceDiagnostic[],
): void {
  const jobs = new Set(definition.contributions.scheduledJobs.map(({ jobType }) => jobType));
  const resources = new Set(
    definition.contributions.importExportResources.map(({ resourceType }) => resourceType),
  );
  for (const jobType of registration.jobTypes) {
    if (!jobs.has(jobType))
      runtimeError(diagnostics, definition, "scheduledJob", jobType, "Worker");
  }
  for (const resourceType of registration.importExportResourceTypes) {
    if (!resources.has(resourceType)) {
      runtimeError(diagnostics, definition, "importExportResource", resourceType, "Worker");
    }
  }
}

function validateMountedRuntime(
  input: BusinessModuleConformanceInput,
  diagnostics: ConformanceDiagnostic[],
): void {
  const declaredApis = new Set(
    input.definitions.flatMap((definition) =>
      definition.contributions.apis.map(({ method, path }) => routeKey(method, path)),
    ),
  );
  const declaredRoutes = new Set(
    input.definitions.flatMap((definition) =>
      definition.contributions.routes.map(({ path }) => path),
    ),
  );
  for (const route of input.runtime.mountedApiRoutes) {
    const key = routeKey(route.method, route.path);
    if (!declaredApis.has(key)) {
      diagnostics.push({
        severity: "error",
        code: "MODULE_MOUNTED_API_NOT_DECLARED",
        contributionKind: "api",
        identifier: key,
        message: `Mounted Business Module API ${key} has no declaration`,
      });
    }
  }
  for (const path of input.runtime.tanstackRoutePaths) {
    if (!declaredRoutes.has(path)) {
      diagnostics.push({
        severity: "error",
        code: "MODULE_MOUNTED_WEB_ROUTE_NOT_DECLARED",
        contributionKind: "route",
        identifier: path,
        message: `Mounted Business Module Web route ${path} has no declaration`,
      });
    }
  }
}

function validateRegistrationOwners(
  input: BusinessModuleConformanceInput,
  definitions: Map<string, BusinessModuleDefinition>,
  diagnostics: ConformanceDiagnostic[],
): void {
  const moduleCodes = [
    ...input.runtime.apiModules.map(({ moduleCode }) => moduleCode),
    ...input.runtime.webModules.map(({ moduleCode }) => moduleCode),
    ...input.runtime.workerModules.map(({ moduleCode }) => moduleCode),
    ...input.runtime.databaseModuleCodes,
  ];
  for (const moduleCode of moduleCodes) {
    if (!definitions.has(moduleCode)) {
      diagnostics.push({
        severity: "error",
        code: "MODULE_RUNTIME_WITHOUT_DEFINITION",
        moduleCode,
        contributionKind: "runtime",
        message: `Runtime registration ${moduleCode} has no Business Module definition`,
      });
    }
  }
}

function runtimeError(
  diagnostics: ConformanceDiagnostic[],
  definition: BusinessModuleDefinition,
  kind: string,
  identifier: string,
  runtime: string,
): void {
  addError(
    diagnostics,
    definition,
    { kind, identifier },
    `MODULE_${runtime.toUpperCase()}_REGISTRATION_MISMATCH`,
    `Declared and registered ${runtime} contributions do not match`,
  );
}

function matchesModule(definition: BusinessModuleDefinition) {
  return ({ moduleCode }: { moduleCode: string }) => moduleCode === definition.moduleCode;
}

function routeKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${path}`;
}
