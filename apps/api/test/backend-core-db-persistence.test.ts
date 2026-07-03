import { runPostgresqlMigrations } from "@web-admin-base/db";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app";
import { InMemoryBackendStore } from "../src/modules/core-foundation/in-memory-store";
import { BackendCoreStoreRepository } from "../src/modules/core-foundation/persistence/backend-core-store-repository";
import { PersistentBackendCoreServices } from "../src/modules/core-foundation/persistence/persistent-backend-core-services";

const postgresqlUrl = process.env.TEST_DATABASE_URL;
const backendCoreConfig = {
  jwtSecret: "postgresql-integration-test-secret"
};

describe("backend core database persistence", () => {
  it.runIf(postgresqlUrl)(
    "persists initialization, sessions, tokens, menus, routes, and permissions in PostgreSQL",
    async () => {
      const url = getPostgresqlUrl();
      await runPostgresqlMigrations({ url });
      await resetBackendCoreDatabase(url);

      const firstRepository = BackendCoreStoreRepository.fromConfig({
        dialect: "postgresql",
        url
      });
      const firstServices = await PersistentBackendCoreServices.create(
        firstRepository,
        backendCoreConfig
      );
      const firstApp = createApp({ backendCoreServices: firstServices });

      try {
        const setupResponse = await firstApp.request("/api/initialization/setup", {
          method: "POST",
          body: JSON.stringify({
            organizationName: "PostgreSQL Organization",
            organizationCode: "pg",
            adminUsername: "pg-admin",
            adminDisplayName: "PostgreSQL Admin",
            adminEmail: "pg-admin@example.com",
            adminPhone: "10000000002",
            adminPassword: "password1"
          })
        });
        const setup = await setupResponse.json();

        const loginResponse = await firstApp.request("/api/auth/login", {
          method: "POST",
          headers: { "user-agent": "vitest" },
          body: JSON.stringify({ username: "pg-admin", password: "password1" })
        });
        const login = await loginResponse.json();
        const setCookie = loginResponse.headers.get("set-cookie") ?? "";

        expect(setupResponse.status).toBe(201);
        expect(loginResponse.status).toBe(200);
        expect(setup.data.organization.id).toBe("1");
        expect(setup.data.admin.id).toBe("1");
        expect(login.data.session.id).toBe("1");

        await firstServices.close();
        const secondRepository = BackendCoreStoreRepository.fromConfig({
          dialect: "postgresql",
          url
        });
        const secondServices = await PersistentBackendCoreServices.create(
          secondRepository,
          backendCoreConfig
        );
        const secondApp = createApp({ backendCoreServices: secondServices });

        try {
          const statusResponse = await secondApp.request("/api/initialization/status");
          const status = await statusResponse.json();
          const usersResponse = await secondApp.request("/api/users", {
            headers: { authorization: `Bearer ${login.data.accessToken}` }
          });
          const users = await usersResponse.json();
          const treeResponse = await secondApp.request("/api/permissions/tree", {
            headers: { authorization: `Bearer ${login.data.accessToken}` }
          });
          const tree = await treeResponse.json();
          const refreshResponse = await secondApp.request("/api/auth/refresh", {
            method: "POST",
            headers: csrfHeaders(setCookie)
          });
          const refresh = await refreshResponse.json();

          expect(status.data).toMatchObject({ initialized: true });
          expect(usersResponse.status).toBe(200);
          expect(users.data.items).toContainEqual(
            expect.objectContaining({ id: "1", username: "pg-admin" })
          );
          expect(treeResponse.status).toBe(200);
          expect(tree.data).toContainEqual(
            expect.objectContaining({
              level: "module",
              key: expect.stringContaining("permissions")
            })
          );
          expect(refreshResponse.status).toBe(200);
          expect(refresh.data.accessToken).toEqual(expect.any(String));
        } finally {
          await secondServices.close();
        }
      } finally {
        await resetBackendCoreDatabase(url);
      }
    }
  );
});

async function resetBackendCoreDatabase(url: string): Promise<void> {
  const repository = BackendCoreStoreRepository.fromConfig({
    dialect: "postgresql",
    url
  });
  try {
    await repository.save(new InMemoryBackendStore());
  } finally {
    await repository.close();
  }
}

function csrfHeaders(setCookieHeader: string): { cookie: string; "x-csrf-token": string } {
  const refreshToken = readSetCookieValue(setCookieHeader, "refresh_token");
  const csrfToken = readSetCookieValue(setCookieHeader, "csrf_token");
  return {
    cookie: `refresh_token=${refreshToken}; csrf_token=${csrfToken}`,
    "x-csrf-token": csrfToken
  };
}

function readSetCookieValue(setCookieHeader: string, name: string): string {
  const match = setCookieHeader.match(new RegExp(`${name}=([^;,]+)`));
  if (!match?.[1]) throw new Error(`Missing ${name} cookie.`);
  return match[1];
}

function getPostgresqlUrl(): string {
  if (!postgresqlUrl) {
    throw new Error("TEST_DATABASE_URL is required for PostgreSQL persistence tests.");
  }
  return postgresqlUrl;
}
