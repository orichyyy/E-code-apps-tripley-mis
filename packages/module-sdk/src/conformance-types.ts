import type {
  BusinessApiModuleRegistration,
  BusinessModuleDefinition,
  BusinessWebModuleRegistration,
  BusinessWorkerModuleRegistration,
} from "@web-admin-base/contracts";
import type { ApiMethod } from "@web-admin-base/contracts";

export type ConformanceDiagnostic = {
  severity: "error";
  code: string;
  moduleCode?: string;
  contributionKind: string;
  identifier?: string;
  message: string;
};

export type BusinessModuleRuntimeCatalog = {
  apiModules: readonly BusinessApiModuleRegistration[];
  webModules: readonly BusinessWebModuleRegistration[];
  workerModules: readonly BusinessWorkerModuleRegistration[];
  databaseModuleCodes: readonly string[];
  mountedApiRoutes: ReadonlyArray<{ method: ApiMethod; path: string }>;
  tanstackRoutePaths: readonly string[];
};

export type BusinessModuleConformanceInput = {
  definitions: readonly BusinessModuleDefinition[];
  runtime: BusinessModuleRuntimeCatalog;
  baseMenuCodes?: readonly string[];
};

export type BusinessModuleConformanceReport = {
  ok: boolean;
  diagnostics: ConformanceDiagnostic[];
};
