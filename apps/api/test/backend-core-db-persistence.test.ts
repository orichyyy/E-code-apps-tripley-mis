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

        const profilePreferencesResponse = await firstApp.request("/api/profile/preferences", {
          method: "PATCH",
          headers: {
            authorization: `Bearer ${login.data.accessToken}`,
            "content-type": "application/json"
          },
          body: JSON.stringify({
            language: "zh",
            themeMode: "dark",
            themeColor: "violet",
            pageTabsEnabled: false
          })
        });
        expect(profilePreferencesResponse.status).toBe(200);

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
          const profileResponse = await secondApp.request("/api/profile", {
            headers: { authorization: `Bearer ${login.data.accessToken}` }
          });
          const profile = await profileResponse.json();
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
          expect(profileResponse.status).toBe(200);
          expect(profile.data.preferences).toMatchObject({
            userId: "1",
            language: "zh",
            themeMode: "dark",
            themeColor: "violet",
            pageTabsEnabled: false
          });
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

  it.runIf(postgresqlUrl)("keeps DB-backed seed initialization idempotent", async () => {
    const url = getPostgresqlUrl();
    await runPostgresqlMigrations({ url });
    await resetBackendCoreDatabase(url);

    const repository = BackendCoreStoreRepository.fromConfig({
      dialect: "postgresql",
      url
    });
    const services = await PersistentBackendCoreServices.create(repository, backendCoreConfig);

    try {
      const input = {
        organizationName: "Seeded PostgreSQL Organization",
        organizationCode: "seeded-pg",
        adminUsername: "seeded-pg-admin",
        adminDisplayName: "Seeded PostgreSQL Admin",
        adminEmail: "seeded-pg-admin@example.com",
        adminPhone: "10000000003",
        adminPassword: "password1"
      };

      const first = await services.seedInitialization(input);
      const second = await services.seedInitialization(input);

      expect(first.seeded).toBe(true);
      expect(second.seeded).toBe(false);
      expect(second.roles).toHaveLength(3);
      expect(second.permissions.length).toBeGreaterThan(0);
      expect(second.apiPermissions.length).toBeGreaterThan(0);
    } finally {
      await services.close();
      await resetBackendCoreDatabase(url);
    }
  });

  it.runIf(postgresqlUrl)("persists DB-backed backend-core mutation flows by aggregate", async () => {
    const url = getPostgresqlUrl();
    await runPostgresqlMigrations({ url });
    await resetBackendCoreDatabase(url);

    const repository = BackendCoreStoreRepository.fromConfig({
      dialect: "postgresql",
      url
    });
    const services = await PersistentBackendCoreServices.create(repository, backendCoreConfig);
    const app = createApp({ backendCoreServices: services });

    try {
      await initializeApp(app);
      const loginResult = await loginAsAdmin(app);
      const authHeaders = loginResult.authHeaders;

      const organization = await requestData(app, "/api/organizations", {
        method: "POST",
        headers: authHeaders,
        body: {
          name: "DB Aggregate Organization",
          code: "db-aggregate-org",
          sortOrder: 20
        },
        expectedStatus: 201
      });
      await requestData(app, `/api/organizations/${organization.id}`, {
        method: "PATCH",
        headers: authHeaders,
        body: { name: "DB Aggregate Organization Updated" }
      });
      await requestData(app, `/api/organizations/${organization.id}/disable`, {
        method: "POST",
        headers: authHeaders
      });
      await requestData(app, `/api/organizations/${organization.id}/enable`, {
        method: "POST",
        headers: authHeaders
      });

      const role = await requestData(app, "/api/roles", {
        method: "POST",
        headers: authHeaders,
        body: {
          name: "DB Aggregate Role",
          code: "db_aggregate_role",
          description: "Created by PostgreSQL aggregate test"
        },
        expectedStatus: 201
      });
      await requestData(app, `/api/roles/${role.id}`, {
        method: "PATCH",
        headers: authHeaders,
        body: { name: "DB Aggregate Role Updated" }
      });
      await requestData(app, `/api/roles/${role.id}/permissions`, {
        method: "PUT",
        headers: authHeaders,
        body: { permissionCodes: ["user:view", "organization:view"] }
      });
      const copiedRole = await requestData(app, `/api/roles/${role.id}/copy`, {
        method: "POST",
        headers: authHeaders,
        expectedStatus: 201
      });
      await requestData(app, `/api/roles/${copiedRole.id}/disable`, {
        method: "POST",
        headers: authHeaders
      });
      await requestData(app, `/api/roles/${copiedRole.id}/enable`, {
        method: "POST",
        headers: authHeaders
      });
      await requestData(app, `/api/roles/${copiedRole.id}`, {
        method: "DELETE",
        headers: authHeaders
      });

      const user = await requestData(app, "/api/users", {
        method: "POST",
        headers: authHeaders,
        body: {
          username: "db-aggregate-user",
          displayName: "DB Aggregate User",
          email: "db-aggregate-user@example.com",
          phone: "10000000004",
          password: "password1",
          primaryOrganizationId: organization.id,
          roleId: role.id
        },
        expectedStatus: 201
      });
      await requestData(app, `/api/users/${user.id}`, {
        method: "PATCH",
        headers: authHeaders,
        body: {
          displayName: "DB Aggregate User Updated",
          employeeNumber: "DB-001"
        }
      });
      await requestData(app, `/api/users/${user.id}/disable`, {
        method: "POST",
        headers: authHeaders
      });
      await requestData(app, `/api/users/${user.id}/enable`, {
        method: "POST",
        headers: authHeaders
      });
      await requestData(app, `/api/users/${user.id}/reset-password`, {
        method: "POST",
        headers: authHeaders,
        body: { password: "password2" }
      });
      await requestData(app, `/api/users/${user.id}/organizations`, {
        method: "POST",
        headers: authHeaders,
        body: { organizationId: "1", roleId: role.id }
      });
      await requestData(app, `/api/users/${user.id}/organizations/1`, {
        method: "DELETE",
        headers: authHeaders
      });
      await requestData(app, `/api/users/${user.id}`, {
        method: "DELETE",
        headers: authHeaders
      });

      const apiPermissions = await requestData(app, "/api/permissions/api", {
        headers: authHeaders
      });
      const menu = await requestData(app, "/api/menus", {
        method: "POST",
        headers: authHeaders,
        body: {
          code: "db.aggregate.menu",
          titleI18nKey: "menu.dbAggregate",
          path: "/db-aggregate",
          requiredPermission: "user:view",
          sortOrder: 999,
          visible: true
        },
        expectedStatus: 201
      });
      await requestData(app, `/api/menus/${menu.id}`, {
        method: "PATCH",
        headers: authHeaders,
        body: {
          titleI18nKey: "menu.dbAggregate.updated",
          visible: false
        }
      });
      await requestData(app, `/api/menus/${menu.id}/api-bindings`, {
        method: "PUT",
        headers: authHeaders,
        body: { apiPermissionIds: [apiPermissions[0].id] }
      });
      await requestData(app, `/api/menus/${menu.id}`, {
        method: "DELETE",
        headers: authHeaders
      });

      await requestData(app, "/api/permissions/sync", {
        method: "POST",
        headers: authHeaders
      });
      await requestData(app, "/api/routes/sync", {
        method: "POST",
        headers: authHeaders
      });
      await requestData(app, `/api/organizations/${organization.id}`, {
        method: "DELETE",
        headers: authHeaders
      });
      await requestData(app, "/api/auth/logout", {
        method: "POST",
        headers: loginResult.csrfAuthHeaders
      });

      await services.close();

      const reloadedRepository = BackendCoreStoreRepository.fromConfig({
        dialect: "postgresql",
        url
      });
      try {
        const store = await reloadedRepository.load();
        const persistedUser = store.users.get(user.id);
        const persistedOrganization = store.organizations.get(organization.id);
        const persistedRole = store.roles.get(role.id);
        const persistedCopiedRole = store.roles.get(copiedRole.id);
        const persistedMenu = store.menus.get(menu.id);
        const persistedSession = store.authSessions.get(loginResult.sessionId);

        expect(persistedUser).toMatchObject({
          displayName: "DB Aggregate User Updated",
          employeeNumber: "DB-001",
          isDeleted: true,
          deletedBy: "1"
        });
        expect(persistedOrganization).toMatchObject({
          name: "DB Aggregate Organization Updated",
          status: "enabled",
          isDeleted: true,
          deletedBy: "1"
        });
        expect(persistedRole).toMatchObject({
          name: "DB Aggregate Role Updated",
          isDeleted: false
        });
        expect(persistedCopiedRole).toMatchObject({
          isDeleted: true,
          deletedBy: "1"
        });
        expect(store.rolePermissions).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ roleId: role.id, permissionCode: "user:view" }),
            expect.objectContaining({ roleId: role.id, permissionCode: "organization:view" })
          ])
        );
        expect([...store.userOrganizationRoles.values()]).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              userId: user.id,
              organizationId: organization.id,
              roleId: role.id,
              isDeleted: true,
              deletedBy: "1"
            })
          ])
        );
        expect(persistedMenu).toMatchObject({
          titleI18nKey: "menu.dbAggregate.updated",
          visible: false,
          isDeleted: true,
          deletedBy: "1"
        });
        expect(persistedSession).toMatchObject({ status: "revoked" });
        expect(store.permissions.size).toBeGreaterThan(0);
        expect(store.apiPermissions.size).toBeGreaterThan(0);
        expect(store.routeMetadata.size).toBeGreaterThan(0);
      } finally {
        await reloadedRepository.close();
      }
    } finally {
      await services.close().catch(() => undefined);
      await resetBackendCoreDatabase(url);
    }
  });

  it.runIf(postgresqlUrl)(
    "persists permission extension records and effective permissions after reload",
    async () => {
      const url = getPostgresqlUrl();
      await runPostgresqlMigrations({ url });
      await resetBackendCoreDatabase(url);

      const repository = BackendCoreStoreRepository.fromConfig({
        dialect: "postgresql",
        url
      });
      const services = await PersistentBackendCoreServices.create(repository, backendCoreConfig);
      const app = createApp({ backendCoreServices: services });

      try {
        await initializeApp(app);
        const loginResult = await loginAsAdmin(app);
        const authHeaders = loginResult.authHeaders;
        const role = await requestData(app, "/api/roles", {
          method: "POST",
          headers: authHeaders,
          body: { name: "Permission Extension Role", code: "permission_extension_role" },
          expectedStatus: 201
        });
        await requestData(app, `/api/roles/${role.id}/permissions`, {
          method: "PUT",
          headers: authHeaders,
          body: { permissionCodes: ["user:view"] }
        });
        const user = await requestData(app, "/api/users", {
          method: "POST",
          headers: authHeaders,
          body: {
            username: "permission-extension-db-user",
            displayName: "Permission Extension DB User",
            email: "permission-extension-db-user@example.com",
            phone: "10000000005",
            password: "password1",
            primaryOrganizationId: "1",
            roleId: role.id
          },
          expectedStatus: 201
        });
        await requestData(app, `/api/roles/${role.id}/data-permissions`, {
          method: "PUT",
          headers: authHeaders,
          body: {
            rules: [
              {
                permissionCode: "user:view",
                effect: "allow",
                rule: { scope: "current_organization" }
              }
            ]
          }
        });
        await requestData(app, `/api/roles/${role.id}/field-permissions`, {
          method: "PUT",
          headers: authHeaders,
          body: {
            rules: [{ resource: "user", field: "email", effect: "readonly" }]
          }
        });
        await requestData(app, `/api/permissions/user-overrides/${user.id}`, {
          method: "PUT",
          headers: authHeaders,
          body: {
            overrides: [
              { permissionCode: "user:view", effect: "deny" },
              { permissionCode: "role:view", effect: "allow" }
            ]
          }
        });
        const firstUserLogin = await app.request("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ username: "permission-extension-db-user", password: "password1" })
        });
        const firstUser = await firstUserLogin.json();
        await requestData(app, "/api/auth/change-password", {
          method: "POST",
          headers: { authorization: `Bearer ${firstUser.data.accessToken}` },
          body: { oldPassword: "password1", newPassword: "password2" }
        });

        await services.close();

        const reloadedRepository = BackendCoreStoreRepository.fromConfig({
          dialect: "postgresql",
          url
        });
        const reloadedServices = await PersistentBackendCoreServices.create(
          reloadedRepository,
          backendCoreConfig
        );
        const reloadedApp = createApp({ backendCoreServices: reloadedServices });

        try {
          const store = await reloadedRepository.load();
          const userLogin = await reloadedApp.request("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({
              username: "permission-extension-db-user",
              password: "password2"
            })
          });
          const login = await userLogin.json();
          expect(userLogin.status).toBe(200);
          const effective = await requestData(reloadedApp, "/api/permissions/effective", {
            headers: { authorization: `Bearer ${login.data.accessToken}` }
          });

          expect([...store.roleDataPermissions.values()]).toEqual([
            expect.objectContaining({
              roleId: role.id,
              permissionCode: "user:view",
              rule: { scope: "current_organization" },
              isDeleted: false
            })
          ]);
          expect([...store.fieldPermissionRules.values()]).toEqual([
            expect.objectContaining({
              targetId: role.id,
              resource: "user",
              field: "email",
              effect: "readonly",
              isDeleted: false
            })
          ]);
          expect([...store.userPermissionOverrides.values()]).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ userId: user.id, permissionCode: "user:view", effect: "deny" }),
              expect.objectContaining({ userId: user.id, permissionCode: "role:view", effect: "allow" })
            ])
          );
          expect(effective.permissionCodes).toEqual(["role:view"]);
          expect(effective.dataPermissions).toEqual([
            expect.objectContaining({ roleId: role.id, permissionCode: "user:view" })
          ]);
          expect(effective.fieldPermissions).toEqual([
            expect.objectContaining({ roleId: role.id, resource: "user", field: "email" })
          ]);
        } finally {
          await reloadedServices.close();
        }
      } finally {
        await services.close().catch(() => undefined);
        await resetBackendCoreDatabase(url);
      }
    }
  );
});

async function initializeApp(app: ReturnType<typeof createApp>): Promise<void> {
  const response = await app.request("/api/initialization/setup", {
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
  expect(response.status).toBe(201);
}

async function loginAsAdmin(app: ReturnType<typeof createApp>) {
  const response = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "user-agent": "vitest" },
    body: JSON.stringify({ username: "pg-admin", password: "password1" })
  });
  const login = await response.json();
  const setCookie = response.headers.get("set-cookie") ?? "";
  expect(response.status).toBe(200);

  return {
    authHeaders: {
      authorization: `Bearer ${login.data.accessToken}`
    },
    csrfAuthHeaders: {
      authorization: `Bearer ${login.data.accessToken}`,
      ...csrfHeaders(setCookie)
    },
    sessionId: login.data.session.id
  };
}

async function requestData(
  app: ReturnType<typeof createApp>,
  path: string,
  options: {
    body?: unknown;
    expectedStatus?: number;
    headers?: Record<string, string>;
    method?: string;
  } = {}
) {
  const response = await app.request(path, {
    method: options.method ?? "GET",
    headers: {
      ...(options.body === undefined ? {} : { "content-type": "application/json" }),
      ...options.headers
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const payload = await response.json();
  expect(response.status).toBe(options.expectedStatus ?? 200);
  return payload.data;
}

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
