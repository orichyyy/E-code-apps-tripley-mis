import { z } from "zod";

import {
  loadFileStorageConfig,
  loadWebhookDeliveryConfig,
  type FileStorageConfig,
  type WebhookDeliveryConfig,
} from "@web-admin-base/adapters";

import {
  defaultBackendCoreConfig,
  type BackendCoreConfig,
} from "../modules/core-foundation/service-context";

const booleanStringSchema = z
  .enum(["true", "false", "1", "0"])
  .transform((value) => value === "true" || value === "1");

const optionalNonEmptyStringSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim().length === 0 ? null : value),
  z.string().min(1).nullable().default(null),
);

const adapterConfigSchema = z
  .object({
    cacheDriver: z.enum(["memory", "database", "redis"]).default("memory"),
    rateLimitDriver: z.enum(["memory", "database", "redis"]).default("memory"),
    queueDriver: z.enum(["memory", "database", "rabbitmq"]).default("database"),
    eventBusDriver: z.enum(["in_process", "database", "rabbitmq"]).default("in_process"),
    redisUrl: optionalNonEmptyStringSchema.default(null),
    rabbitMqUrl: optionalNonEmptyStringSchema.default(null),
  })
  .superRefine((adapters, context) => {
    if (
      (adapters.cacheDriver === "redis" || adapters.rateLimitDriver === "redis") &&
      !adapters.redisUrl
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["redisUrl"],
        message: "REDIS_URL is required when CACHE_DRIVER or RATE_LIMIT_DRIVER is redis.",
      });
    }
    if (
      (adapters.queueDriver === "rabbitmq" || adapters.eventBusDriver === "rabbitmq") &&
      !adapters.rabbitMqUrl
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rabbitMqUrl"],
        message: "RABBITMQ_URL is required when QUEUE_DRIVER or EVENT_BUS_DRIVER is rabbitmq.",
      });
    }
  });

const apiConfigSchema = z.object({
  nodeEnv: z.enum(["development", "test", "demo", "production"]).default("development"),
  port: z.coerce.number().int().positive().default(3000),
  adapters: adapterConfigSchema,
  smtp: z
    .object({
      enabled: booleanStringSchema.default("false"),
      host: optionalNonEmptyStringSchema.default(null),
      port: z.coerce.number().int().positive().default(587),
      secure: booleanStringSchema.default("false"),
      username: optionalNonEmptyStringSchema.default(null),
      password: optionalNonEmptyStringSchema.default(null),
      from: optionalNonEmptyStringSchema.default(null),
    })
    .superRefine((smtp, context) => {
      if (!smtp.enabled) return;
      if (!smtp.host) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["host"],
          message: "SMTP_HOST is required when SMTP_ENABLED is true.",
        });
      }
      if (!smtp.from) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["from"],
          message: "SMTP_FROM is required when SMTP_ENABLED is true.",
        });
      }
    }),
  backendCore: z.object({
    jwtSecret: z.string().min(1).default(defaultBackendCoreConfig.jwtSecret),
    jwtIssuer: z.string().min(1).default(defaultBackendCoreConfig.jwtIssuer),
    accessTokenTtlSeconds: z.coerce
      .number()
      .int()
      .positive()
      .default(defaultBackendCoreConfig.accessTokenTtlSeconds),
    refreshTokenTtlDays: z.coerce
      .number()
      .int()
      .positive()
      .default(defaultBackendCoreConfig.refreshTokenTtlDays),
    refreshTokenCookiePath: z
      .string()
      .min(1)
      .default(defaultBackendCoreConfig.refreshTokenCookiePath),
    refreshTokenCookieSameSite: z
      .enum(["Strict", "Lax", "None"])
      .default(defaultBackendCoreConfig.refreshTokenCookieSameSite),
    refreshTokenCookieSecure: booleanStringSchema.default(
      defaultBackendCoreConfig.refreshTokenCookieSecure ? "true" : "false",
    ),
    refreshTokenCookieDomain: optionalNonEmptyStringSchema.default(
      defaultBackendCoreConfig.refreshTokenCookieDomain,
    ),
    failedLoginMaxAttempts: z.coerce
      .number()
      .int()
      .positive()
      .default(defaultBackendCoreConfig.failedLoginMaxAttempts),
    failedLoginLockMinutes: z.coerce
      .number()
      .int()
      .positive()
      .default(defaultBackendCoreConfig.failedLoginLockMinutes),
    maxOrganizationDepth: z.coerce
      .number()
      .int()
      .min(1)
      .max(8)
      .default(defaultBackendCoreConfig.maxOrganizationDepth),
    passwordPolicy: z.object({
      minLength: z.coerce
        .number()
        .int()
        .positive()
        .default(defaultBackendCoreConfig.passwordPolicy.minLength),
      requireLetters: booleanStringSchema.default(
        defaultBackendCoreConfig.passwordPolicy.requireLetters ? "true" : "false",
      ),
      requireNumbers: booleanStringSchema.default(
        defaultBackendCoreConfig.passwordPolicy.requireNumbers ? "true" : "false",
      ),
      periodicChangeDays: z.coerce
        .number()
        .int()
        .nonnegative()
        .default(defaultBackendCoreConfig.passwordPolicy.periodicChangeDays),
    }),
  }),
});

export type ApiConfig = Omit<z.infer<typeof apiConfigSchema>, "backendCore"> & {
  backendCore: BackendCoreConfig;
  storage: FileStorageConfig;
  webhook: WebhookDeliveryConfig;
};

export function loadApiConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const config = apiConfigSchema.parse({
    nodeEnv: env.NODE_ENV,
    port: env.API_PORT,
    adapters: {
      cacheDriver: env.CACHE_DRIVER,
      rateLimitDriver: env.RATE_LIMIT_DRIVER,
      queueDriver: env.QUEUE_DRIVER,
      eventBusDriver: env.EVENT_BUS_DRIVER,
      redisUrl: env.REDIS_URL,
      rabbitMqUrl: env.RABBITMQ_URL,
    },
    smtp: {
      enabled: env.SMTP_ENABLED,
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      username: env.SMTP_USERNAME,
      password: env.SMTP_PASSWORD,
      from: env.SMTP_FROM,
    },
    backendCore: {
      jwtSecret: env.JWT_SECRET,
      jwtIssuer: env.JWT_ISSUER,
      accessTokenTtlSeconds: env.ACCESS_TOKEN_TTL_SECONDS,
      refreshTokenTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
      refreshTokenCookiePath: env.AUTH_REFRESH_COOKIE_PATH,
      refreshTokenCookieSameSite: env.AUTH_REFRESH_COOKIE_SAMESITE,
      refreshTokenCookieSecure: env.AUTH_REFRESH_COOKIE_SECURE,
      refreshTokenCookieDomain: env.AUTH_REFRESH_COOKIE_DOMAIN,
      failedLoginMaxAttempts: env.FAILED_LOGIN_MAX_ATTEMPTS,
      failedLoginLockMinutes: env.FAILED_LOGIN_LOCK_MINUTES,
      maxOrganizationDepth: env.ORGANIZATION_MAX_DEPTH,
      passwordPolicy: {
        minLength: env.PASSWORD_MIN_LENGTH,
        requireLetters: env.PASSWORD_REQUIRE_LETTERS,
        requireNumbers: env.PASSWORD_REQUIRE_NUMBERS,
        periodicChangeDays: env.PASSWORD_PERIODIC_CHANGE_DAYS,
      },
    },
  });
  return {
    ...config,
    storage: loadFileStorageConfig(env),
    webhook: loadWebhookDeliveryConfig(env),
  } as ApiConfig;
}
