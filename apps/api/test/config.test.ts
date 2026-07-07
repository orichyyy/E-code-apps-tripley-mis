import { describe, expect, it } from "vitest";

import { createApp, createDefaultAppDependencies } from "../src/app";
import { loadApiConfig } from "../src/config/load-config";

describe("API configuration", () => {
  it("loads backend core security settings from environment values", () => {
    const config = loadApiConfig({
      NODE_ENV: "test",
      API_PORT: "4001",
      JWT_SECRET: "configured-secret",
      JWT_ISSUER: "configured-issuer",
      ACCESS_TOKEN_TTL_SECONDS: "120",
      REFRESH_TOKEN_TTL_DAYS: "7",
      AUTH_REFRESH_COOKIE_PATH: "/api/custom-refresh",
      AUTH_REFRESH_COOKIE_SAMESITE: "None",
      AUTH_REFRESH_COOKIE_SECURE: "true",
      AUTH_REFRESH_COOKIE_DOMAIN: "admin.example.com",
      FAILED_LOGIN_MAX_ATTEMPTS: "3",
      FAILED_LOGIN_LOCK_MINUTES: "10",
      ORGANIZATION_MAX_DEPTH: "6",
      PASSWORD_MIN_LENGTH: "12",
      PASSWORD_REQUIRE_LETTERS: "false",
      PASSWORD_REQUIRE_NUMBERS: "true",
      PASSWORD_PERIODIC_CHANGE_DAYS: "180",
    });

    expect(config).toMatchObject({
      nodeEnv: "test",
      port: 4001,
      adapters: {
        cacheDriver: "memory",
        rateLimitDriver: "memory",
        queueDriver: "database",
        eventBusDriver: "in_process",
        redisUrl: null,
        rabbitMqUrl: null,
      },
      backendCore: {
        jwtSecret: "configured-secret",
        jwtIssuer: "configured-issuer",
        accessTokenTtlSeconds: 120,
        refreshTokenTtlDays: 7,
        refreshTokenCookiePath: "/api/custom-refresh",
        refreshTokenCookieSameSite: "None",
        refreshTokenCookieSecure: true,
        refreshTokenCookieDomain: "admin.example.com",
        failedLoginMaxAttempts: 3,
        failedLoginLockMinutes: 10,
        maxOrganizationDepth: 6,
        passwordPolicy: {
          minLength: 12,
          requireLetters: false,
          requireNumbers: true,
          periodicChangeDays: 180,
        },
      },
    });
  });

  it("loads optional adapter runtime settings", () => {
    const config = loadApiConfig({
      NODE_ENV: "test",
      CACHE_DRIVER: "redis",
      RATE_LIMIT_DRIVER: "redis",
      QUEUE_DRIVER: "rabbitmq",
      EVENT_BUS_DRIVER: "rabbitmq",
      REDIS_URL: "redis://127.0.0.1:6379",
      RABBITMQ_URL: "amqp://guest:guest@127.0.0.1:5672",
    });

    expect(config.adapters).toEqual({
      cacheDriver: "redis",
      rateLimitDriver: "redis",
      queueDriver: "rabbitmq",
      eventBusDriver: "rabbitmq",
      redisUrl: "redis://127.0.0.1:6379",
      rabbitMqUrl: "amqp://guest:guest@127.0.0.1:5672",
    });
  });

  it("rejects optional external adapter drivers without required URLs", () => {
    expect(() =>
      loadApiConfig({
        NODE_ENV: "test",
        CACHE_DRIVER: "redis",
      }),
    ).toThrow(/REDIS_URL/);
    expect(() =>
      loadApiConfig({
        NODE_ENV: "test",
        QUEUE_DRIVER: "rabbitmq",
      }),
    ).toThrow(/RABBITMQ_URL/);
  });

  it("uses loaded password policy in default backend core dependencies", async () => {
    const config = loadApiConfig({
      NODE_ENV: "test",
      PASSWORD_MIN_LENGTH: "12",
    });
    const app = createApp(createDefaultAppDependencies(config));

    const response = await app.request("/api/initialization/setup", {
      method: "POST",
      body: JSON.stringify({
        organizationName: "Default Organization",
        organizationCode: "default",
        adminUsername: "admin",
        adminDisplayName: "Super Admin",
        adminEmail: "admin@example.com",
        adminPhone: "10000000000",
        adminPassword: "password1",
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("PASSWORD_MIN_LENGTH");
  });
});
