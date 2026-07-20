import {
  createDatabaseCacheAdapter,
  createDatabaseQueueAdapter,
  createInMemoryQueueAdapter,
  createInMemoryNotificationChannelAdapter,
  createConfiguredFileStorageAdapter,
  createRabbitMqQueueAdapter,
  createRedisCacheAdapter,
  createSmtpNotificationChannelAdapter,
  type CacheAdapter,
  type FileStorageAdapter,
  type NotificationChannelAdapter,
  type QueueAdapter,
} from "@web-admin-base/adapters";
import {
  businessModuleDefinitions,
  createOpenApiDocument,
  healthResponseSchema,
} from "@web-admin-base/contracts";
import { createBusinessModuleRegistry } from "@web-admin-base/module-sdk";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { loadApiConfig, type ApiConfig } from "./config/load-config";
import { createBusinessModuleRoutes } from "./business-modules/routes";
import type { AppBindings } from "./app-bindings";
import { createErrorResponse, normalizeError } from "./core/errors/error-response";
import { createApiAuthorizationMiddleware } from "./middleware/api-authorization";
import { createBusinessModuleActivationMiddleware } from "./middleware/business-module-activation";
import { requestIdMiddleware } from "./middleware/request-id";
import { createCommunicationsRoutes } from "./modules/communications/communications.routes";
import { CommunicationsRepository } from "./modules/communications/communications.repository";
import { CommunicationsServices } from "./modules/communications/communications.service";
import { createCoreFoundationRoutes } from "./modules/core-foundation/core-foundation.routes";
import {
  createInMemoryBackendCoreServices,
  type BackendCoreServices,
} from "./modules/core-foundation/services";
import { createPersistentBackendCoreServices } from "./modules/core-foundation/persistence/persistent-backend-core-services";
import { createManifestRoutes } from "./modules/manifests/manifest.routes";
import { InMemoryModuleLifecycleStore } from "./modules/module-lifecycle/in-memory-module-lifecycle.store";
import { ModuleLifecycleRepository } from "./modules/module-lifecycle/module-lifecycle.repository";
import { createModuleLifecycleRoutes } from "./modules/module-lifecycle/module-lifecycle.routes";
import { ModuleLifecycleService } from "./modules/module-lifecycle/module-lifecycle.service";
import { createInfrastructureRoutes } from "./modules/infrastructure/infrastructure.routes";
import { InfrastructureRepository } from "./modules/infrastructure/infrastructure.repository";
import { InfrastructureServices } from "./modules/infrastructure/infrastructure.service";
import { createSystemManagementRoutes } from "./modules/system-management/system-management.routes";
import { SystemManagementServices } from "./modules/system-management/system-management.service";
import {
  createStructuredLoggingMiddleware,
  noopStructuredLogSink,
  type StructuredLogSink,
} from "./observability/structured-logging";

export type AppDependencies = {
  backendCoreServices: BackendCoreServices;
  moduleLifecycleService?: ModuleLifecycleService;
  communicationsServices?: CommunicationsServices;
  infrastructureServices?: InfrastructureServices;
  systemManagementServices?: SystemManagementServices;
  structuredLogSink?: StructuredLogSink;
};

export function createApp(dependencies: AppDependencies = createDefaultAppDependencies()) {
  const structuredLogSink = dependencies.structuredLogSink ?? noopStructuredLogSink;
  const communicationsServices =
    dependencies.communicationsServices ?? CommunicationsServices.inMemory();
  const infrastructureServices =
    dependencies.infrastructureServices ?? InfrastructureServices.inMemory();
  const systemManagementServices =
    dependencies.systemManagementServices ?? SystemManagementServices.inMemory();
  const moduleLifecycleService =
    dependencies.moduleLifecycleService ??
    new ModuleLifecycleService(
      createBusinessModuleRegistry(businessModuleDefinitions),
      new InMemoryModuleLifecycleStore(),
      {
        afterApply: (definitions) =>
          dependencies.backendCoreServices.refreshBusinessModuleMetadata(definitions),
        beforeCompatibilitySync: () =>
          dependencies.backendCoreServices.synchronizeBaseManifests().then(() => undefined),
      },
    );
  const app = new Hono<AppBindings>().basePath("/api");

  app.use("*", requestIdMiddleware);
  app.use("*", createStructuredLoggingMiddleware(structuredLogSink));
  app.use("*", createBusinessModuleActivationMiddleware(moduleLifecycleService));
  app.use(
    "*",
    createApiAuthorizationMiddleware(dependencies.backendCoreServices, moduleLifecycleService),
  );

  app.get("/health", (context) => {
    return context.json(
      healthResponseSchema.parse({
        status: "ok",
        service: "api",
        requestId: context.get("requestId"),
        timestamp: new Date().toISOString(),
      }),
    );
  });

  app.get("/metrics", (context) => {
    return context.json({
      data: {
        status: "reserved",
        service: "api",
        requestId: context.get("requestId"),
        timestamp: new Date().toISOString(),
      },
    });
  });

  app.get("/openapi.json", (context) => {
    return context.json(createOpenApiDocument());
  });

  const routedApp = app
    .route(
      "/",
      createCoreFoundationRoutes(
        dependencies.backendCoreServices,
        (initializedBy) => moduleLifecycleService.bootstrap(initializedBy).then(() => undefined),
        (actorId) => moduleLifecycleService.synchronizeCompatibility(actorId),
        () => moduleLifecycleService.assertCanApply(),
      ),
    )
    .route("/", createCommunicationsRoutes(communicationsServices))
    .route("/", createInfrastructureRoutes(infrastructureServices))
    .route("/", createSystemManagementRoutes(systemManagementServices))
    .route("/", createModuleLifecycleRoutes(moduleLifecycleService))
    .route("/", createManifestRoutes())
    .route("/", createBusinessModuleRoutes());

  routedApp.notFound((context) => {
    return context.json(
      {
        error: {
          code: "SYSTEM_NOT_FOUND",
          message: "Route not found",
        },
        requestId: context.get("requestId"),
      },
      404,
    );
  });

  routedApp.onError((error, context) => {
    const appError = normalizeError(error);
    return context.json(
      createErrorResponse(appError, context.get("requestId")),
      appError.status as ContentfulStatusCode,
    );
  });

  return routedApp;
}

export type ApiApp = ReturnType<typeof createApp>;

export function createDefaultAppDependencies(
  config: ApiConfig = loadApiConfig(),
  storage?: FileStorageAdapter,
): AppDependencies {
  const backendCoreServices = createInMemoryBackendCoreServices(config.backendCore);
  return {
    backendCoreServices,
    moduleLifecycleService: new ModuleLifecycleService(
      createBusinessModuleRegistry(businessModuleDefinitions),
      new InMemoryModuleLifecycleStore(),
      {
        afterApply: (definitions) => backendCoreServices.refreshBusinessModuleMetadata(definitions),
        beforeCompatibilitySync: () =>
          backendCoreServices.synchronizeBaseManifests().then(() => undefined),
      },
    ),
    communicationsServices: CommunicationsServices.inMemory(() =>
      backendCoreServices.listOrganizations().map((organization) => ({
        id: organization.id,
        path: organization.path,
        level: organization.level,
        status: organization.status,
        isDeleted: organization.isDeleted,
      })),
    ),
    infrastructureServices: InfrastructureServices.inMemory({
      storage,
      presignedUrlTtlSeconds: config.storage.presignedUrlTtlSeconds,
      notificationChannel: createNotificationChannel(config),
      emailDeliveryConfig: config.emailDelivery,
      smtpEnabled: config.smtp.enabled,
    }),
    systemManagementServices: SystemManagementServices.inMemory(),
    structuredLogSink: noopStructuredLogSink,
  };
}

export async function createDatabaseBackedAppDependencies(
  config: ApiConfig = loadApiConfig(),
  storage?: FileStorageAdapter,
): Promise<AppDependencies> {
  const infrastructureRepository = InfrastructureRepository.fromEnvironment();
  const permissionCacheAdapter = await createPermissionCacheAdapter(
    config,
    infrastructureRepository,
  );
  const fileStorage = storage ?? (await createRuntimeFileStorage(config));
  const backendCoreServices = await createPersistentBackendCoreServices(
    config.backendCore,
    undefined,
    {
      permissionCacheAdapter,
      webhookEventsEnabled: config.webhook.enabled,
    },
  );
  const moduleLifecycleRepository = ModuleLifecycleRepository.fromEnvironment();
  const moduleLifecycleService = new ModuleLifecycleService(
    createBusinessModuleRegistry(businessModuleDefinitions),
    moduleLifecycleRepository,
    { afterApply: (definitions) => backendCoreServices.refreshBusinessModuleMetadata(definitions) },
  );
  await backendCoreServices.refreshBusinessModuleMetadata(
    await moduleLifecycleService.getActiveDefinitions(),
  );
  return {
    backendCoreServices,
    moduleLifecycleService,
    communicationsServices: CommunicationsServices.database(
      CommunicationsRepository.fromEnvironment(),
      config.webhook,
    ),
    infrastructureServices: InfrastructureServices.database(infrastructureRepository, {
      storage: fileStorage,
      presignedUrlTtlSeconds: config.storage.presignedUrlTtlSeconds,
      notificationChannel: createNotificationChannel(config),
      emailDeliveryConfig: config.emailDelivery,
      smtpEnabled: config.smtp.enabled,
      queue: await createInfrastructureQueue(config, infrastructureRepository),
    }),
    systemManagementServices: SystemManagementServices.database(),
    structuredLogSink: noopStructuredLogSink,
  };
}

export async function createRuntimeFileStorage(config: ApiConfig): Promise<FileStorageAdapter> {
  const storage = await createConfiguredFileStorageAdapter(config.storage);
  const health = await storage.healthCheck();
  if (!health.ok) throw new Error(`File storage is unavailable: ${health.message ?? "unknown"}`);
  return storage;
}

async function createPermissionCacheAdapter(
  config: ApiConfig,
  repository: InfrastructureRepository,
): Promise<CacheAdapter | undefined> {
  if (config.adapters.cacheDriver === "database") {
    return createDatabaseCacheAdapter(repository.executor);
  }
  if (config.adapters.cacheDriver !== "redis") return undefined;
  if (!config.adapters.redisUrl) {
    throw new Error("REDIS_URL is required when CACHE_DRIVER=redis.");
  }
  return createRedisCacheAdapter({ url: config.adapters.redisUrl });
}

async function createInfrastructureQueue(
  config: ApiConfig,
  repository: InfrastructureRepository,
): Promise<QueueAdapter | undefined> {
  if (config.adapters.queueDriver === "rabbitmq") {
    if (!config.adapters.rabbitMqUrl) {
      throw new Error("RABBITMQ_URL is required when QUEUE_DRIVER=rabbitmq.");
    }
    return createRabbitMqQueueAdapter({ url: config.adapters.rabbitMqUrl });
  }
  if (config.adapters.queueDriver === "database") {
    return createDatabaseQueueAdapter(repository.executor);
  }
  return createInMemoryQueueAdapter();
}

function createNotificationChannel(config: ApiConfig): NotificationChannelAdapter {
  if (!config.smtp.enabled) return createInMemoryNotificationChannelAdapter();
  if (!config.smtp.host || !config.smtp.from) {
    throw new Error("SMTP_HOST and SMTP_FROM are required when SMTP_ENABLED is true.");
  }
  return createSmtpNotificationChannelAdapter({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    username: config.smtp.username,
    password: config.smtp.password,
    from: config.smtp.from,
    timeoutMs: config.smtp.timeoutMs,
    allowInsecureLocalhost: config.smtp.allowInsecureLocalhost,
  });
}
