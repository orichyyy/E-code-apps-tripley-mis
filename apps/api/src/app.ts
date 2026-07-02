import { healthResponseSchema } from "@web-admin-base/contracts";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { loadApiConfig, type ApiConfig } from "./config/load-config";
import type { AuthContextVariables } from "./core/auth-context/auth-context";
import { createErrorResponse, normalizeError } from "./core/errors/error-response";
import { createApiAuthorizationMiddleware } from "./middleware/api-authorization";
import { requestIdMiddleware, type RequestIdVariables } from "./middleware/request-id";
import { createCoreFoundationRoutes } from "./modules/core-foundation/core-foundation.routes";
import {
  createInMemoryBackendCoreServices,
  type BackendCoreServices
} from "./modules/core-foundation/services";
import { createManifestRoutes } from "./modules/manifests/manifest.routes";

type AppBindings = {
  Variables: RequestIdVariables & AuthContextVariables;
};

export type AppDependencies = {
  backendCoreServices: BackendCoreServices;
};

export function createApp(dependencies: AppDependencies = createDefaultAppDependencies()) {
  const app = new Hono<AppBindings>().basePath("/api");

  app.use("*", requestIdMiddleware);
  app.use("*", createApiAuthorizationMiddleware(dependencies.backendCoreServices));

  app.get("/health", (context) => {
    return context.json(
      healthResponseSchema.parse({
        status: "ok",
        service: "api",
        requestId: context.get("requestId"),
        timestamp: new Date().toISOString()
      })
    );
  });

  app.route("/", createCoreFoundationRoutes(dependencies.backendCoreServices));
  app.route("/", createManifestRoutes());

  app.notFound((context) => {
    return context.json(
      {
        error: {
          code: "SYSTEM_NOT_FOUND",
          message: "Route not found"
        },
        requestId: context.get("requestId")
      },
      404
    );
  });

  app.onError((error, context) => {
    const appError = normalizeError(error);
    return context.json(
      createErrorResponse(appError, context.get("requestId")),
      appError.status as ContentfulStatusCode
    );
  });

  return app;
}

export type ApiApp = ReturnType<typeof createApp>;

export function createDefaultAppDependencies(config: ApiConfig = loadApiConfig()): AppDependencies {
  return {
    backendCoreServices: createInMemoryBackendCoreServices(config.backendCore)
  };
}
