import {
  baseMenuManifest,
  businessModuleDefinitions,
  type ApiMethod,
} from "../packages/contracts/src/index";
import { businessModuleMigrationRegistry } from "../packages/db/src/index";
import { businessApiModuleRegistry } from "../apps/api/src/business-modules/registry";
import { createApp } from "../apps/api/src/app";
import { businessWebModuleRegistry } from "../apps/web/src/business-modules/registry";
import { router } from "../apps/web/src/app/router";
import { businessWorkerModuleRegistry } from "../apps/worker/src/business-modules/registry";

const apiMethods = new Set<ApiMethod>(["GET", "POST", "PUT", "PATCH", "DELETE"]);

export function createProductionModuleConformanceInput() {
  const mountedApiRoutes = createApp()
    .routes.filter(
      ({ method, path }) => path.startsWith("/api/modules/") && apiMethods.has(method as ApiMethod),
    )
    .map(({ method, path }) => ({ method: method as ApiMethod, path }));
  const tanstackRoutePaths = Object.values(router.routesById)
    .map(({ fullPath }) => fullPath)
    .filter((path) => path.startsWith("/modules/"));

  return {
    definitions: businessModuleDefinitions,
    baseMenuCodes: baseMenuManifest.map(({ code }) => code),
    runtime: {
      apiModules: businessApiModuleRegistry,
      webModules: businessWebModuleRegistry,
      workerModules: businessWorkerModuleRegistry,
      databaseModuleCodes: businessModuleMigrationRegistry.map(({ moduleCode }) => moduleCode),
      mountedApiRoutes,
      tanstackRoutePaths,
    },
  };
}
