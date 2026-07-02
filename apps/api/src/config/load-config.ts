import { z } from "zod";

import {
  defaultBackendCoreConfig,
  type BackendCoreConfig
} from "../modules/core-foundation/service-context";

const booleanStringSchema = z
  .enum(["true", "false", "1", "0"])
  .transform((value) => value === "true" || value === "1");

const apiConfigSchema = z.object({
  nodeEnv: z.enum(["development", "test", "demo", "production"]).default("development"),
  port: z.coerce.number().int().positive().default(3000),
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
        defaultBackendCoreConfig.passwordPolicy.requireLetters ? "true" : "false"
      ),
      requireNumbers: booleanStringSchema.default(
        defaultBackendCoreConfig.passwordPolicy.requireNumbers ? "true" : "false"
      ),
      periodicChangeDays: z.coerce
        .number()
        .int()
        .nonnegative()
        .default(defaultBackendCoreConfig.passwordPolicy.periodicChangeDays)
    })
  })
});

export type ApiConfig = Omit<z.infer<typeof apiConfigSchema>, "backendCore"> & {
  backendCore: BackendCoreConfig;
};

export function loadApiConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  return apiConfigSchema.parse({
    nodeEnv: env.NODE_ENV,
    port: env.API_PORT,
    backendCore: {
      jwtSecret: env.JWT_SECRET,
      jwtIssuer: env.JWT_ISSUER,
      accessTokenTtlSeconds: env.ACCESS_TOKEN_TTL_SECONDS,
      refreshTokenTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
      failedLoginMaxAttempts: env.FAILED_LOGIN_MAX_ATTEMPTS,
      failedLoginLockMinutes: env.FAILED_LOGIN_LOCK_MINUTES,
      maxOrganizationDepth: env.ORGANIZATION_MAX_DEPTH,
      passwordPolicy: {
        minLength: env.PASSWORD_MIN_LENGTH,
        requireLetters: env.PASSWORD_REQUIRE_LETTERS,
        requireNumbers: env.PASSWORD_REQUIRE_NUMBERS,
        periodicChangeDays: env.PASSWORD_PERIODIC_CHANGE_DAYS
      }
    }
  }) as ApiConfig;
}
