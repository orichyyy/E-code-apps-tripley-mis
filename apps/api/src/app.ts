import { createOpenApiDocument, healthResponseSchema } from "@web-admin-base/contracts";
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
import { createPersistentBackendCoreServices } from "./modules/core-foundation/persistence/persistent-backend-core-services";
import { createManifestRoutes } from "./modules/manifests/manifest.routes";
import { createInfrastructureRoutes } from "./modules/infrastructure/infrastructure.routes";
import { InfrastructureServices } from "./modules/infrastructure/infrastructure.service";
import {
  createStructuredLoggingMiddleware,
  noopStructuredLogSink,
  type StructuredLogSink
} from "./observability/structured-logging";

type AppBindings = {
  Variables: RequestIdVariables & AuthContextVariables;
};

export type AppDependencies = {
  backendCoreServices: BackendCoreServices;
  infrastructureServices?: InfrastructureServices;
  structuredLogSink?: StructuredLogSink;
};

export function createApp(dependencies: AppDependencies = createDefaultAppDependencies()) {
  const structuredLogSink = dependencies.structuredLogSink ?? noopStructuredLogSink;
  const infrastructureServices = dependencies.infrastructureServices ?? InfrastructureServices.inMemory();
  const app = new Hono<AppBindings>().basePath("/api");

  app.use("*", requestIdMiddleware);
  app.use("*", createStructuredLoggingMiddleware(structuredLogSink));
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

  app.get("/metrics", (context) => {
    return context.json({
      data: {
        status: "reserved",
        service: "api",
        requestId: context.get("requestId"),
        timestamp: new Date().toISOString()
      }
    });
  });

  app.get("/openapi.json", (context) => {
    return context.json(createOpenApiDocument());
  });

  const routedApp = app
    .route("/", createCoreFoundationRoutes(dependencies.backendCoreServices))
    .route("/", createInfrastructureRoutes(infrastructureServices))
    .route("/", createManifestRoutes());

  routedApp.notFound((context) => {
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

  routedApp.onError((error, context) => {
    const appError = normalizeError(error);
    return context.json(
      createErrorResponse(appError, context.get("requestId")),
      appError.status as ContentfulStatusCode
    );
  });

  return routedApp;
}

export type ApiApp = ReturnType<typeof createApp>;

export function createDefaultAppDependencies(config: ApiConfig = loadApiConfig()): AppDependencies {
  return {
    backendCoreServices: createInMemoryBackendCoreServices(config.backendCore),
    infrastructureServices: InfrastructureServices.inMemory(),
    structuredLogSink: noopStructuredLogSink
  };
}

export async function createDatabaseBackedAppDependencies(
  config: ApiConfig = loadApiConfig()
): Promise<AppDependencies> {
  return {
    backendCoreServices: await createPersistentBackendCoreServices(config.backendCore),
    infrastructureServices: InfrastructureServices.database(),
    structuredLogSink: noopStructuredLogSink
  };
}
