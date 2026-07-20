import type { ApiMethod } from "./types";

export type BusinessApiRouteRegistration = {
  code: string;
  method: ApiMethod;
  path: string;
};

export type BusinessApiModuleRegistration = {
  moduleCode: string;
  routes: BusinessApiRouteRegistration[];
};

export type BusinessWebRouteRegistration = {
  routeCode: string;
  path: string;
};

export type BusinessWebModuleRegistration = {
  moduleCode: string;
  routes: BusinessWebRouteRegistration[];
};

export type BusinessWorkerModuleRegistration = {
  moduleCode: string;
  jobTypes: string[];
  importExportResourceTypes: string[];
};
