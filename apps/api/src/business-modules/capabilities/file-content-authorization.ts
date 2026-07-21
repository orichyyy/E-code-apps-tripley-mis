import { businessModuleDefinitions } from "@web-admin-base/contracts";

import { createKnownError } from "../../core/errors/error-codes";
import type { BackendCoreServices } from "../../modules/core-foundation/services";
import type { FileContentAuthorization } from "../../modules/infrastructure/infrastructure.routes";
import type { InfrastructureServices } from "../../modules/infrastructure/infrastructure.service";
import type { ModuleLifecycleService } from "../../modules/module-lifecycle/module-lifecycle.service";
import { businessApiModuleRegistry } from "../registry";
import { BusinessModuleFileAccessAuthorizer } from "./file-access-authorizer";

export function createBusinessModuleFileContentAuthorization(options: {
  backend: BackendCoreServices;
  infrastructure: InfrastructureServices;
  lifecycle: ModuleLifecycleService;
}): FileContentAuthorization {
  const authorizer = new BusinessModuleFileAccessAuthorizer(
    businessModuleDefinitions,
    businessApiModuleRegistry,
    (moduleCode) => options.lifecycle.isModuleActive(moduleCode),
  );
  return async ({ fileId, mode, auth, requestId }) => {
    if (await hasGlobalFilePermission(options.backend, auth, mode)) return;
    const user = await options.backend.getCurrentUserContext(auth);
    const references = await options.infrastructure.listFileReferences(fileId);
    const allowed = await authorizer.canView(
      {
        moduleCode: moduleCodeFromReferences(references),
        source: "api",
        actorId: auth.userId,
        organizationId: auth.currentOrganizationId,
        sessionId: auth.sessionId,
        requestId,
        traceId: requestId,
        correlationId: requestId,
        locale: user.preferences.language ?? "en",
      },
      fileId,
      references,
    );
    if (!allowed) throw createKnownError("PERMISSION_API_DENIED");
  };
}

function hasGlobalFilePermission(
  backend: BackendCoreServices,
  auth: Parameters<BackendCoreServices["getCurrentUserContext"]>[0],
  mode: "download" | "preview",
): Promise<boolean> {
  return backend.hasPermission(
    auth.userId,
    auth.currentOrganizationId,
    mode === "download" ? "file:download" : "file:preview",
  );
}

function moduleCodeFromReferences(references: Array<{ resourceType: string }>): string {
  const resourceType = references.find((item) => item.resourceType.includes("."))?.resourceType;
  return typeof resourceType === "string" ? resourceType.split(".")[0]! : "unregistered-module";
}
