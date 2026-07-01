import { healthResponseSchema } from "@web-admin-base/contracts";
import { Hono } from "hono";

import { requestIdMiddleware, type RequestIdVariables } from "./middleware/request-id";
import { createCoreFoundationRoutes } from "./modules/core-foundation/core-foundation.routes";
import {
  createInMemoryBackendCoreServices,
  type BackendCoreServices
} from "./modules/core-foundation/services";
import { createManifestRoutes } from "./modules/manifests/manifest.routes";

type AppBindings = {
  Variables: RequestIdVariables;
};

export type AppDependencies = {
  backendCoreServices: BackendCoreServices;
};

export function createApp(dependencies: AppDependencies = createDefaultAppDependencies()) {
  const app = new Hono<AppBindings>().basePath("/api");

  app.use("*", requestIdMiddleware);

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
    return context.json(
      {
        error: {
          code: "SYSTEM_INTERNAL_ERROR",
          message: error.message
        },
        requestId: context.get("requestId")
      },
      500
    );
  });

  return app;
}

export type ApiApp = ReturnType<typeof createApp>;

export function createDefaultAppDependencies(): AppDependencies {
  return {
    backendCoreServices: createInMemoryBackendCoreServices()
  };
}
