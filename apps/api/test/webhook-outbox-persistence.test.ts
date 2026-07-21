import { createPostgresqlPool, runPostgresqlMigrations } from "@web-admin-base/db";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app";
import { InMemoryBackendStore } from "../src/modules/core-foundation/in-memory-store";
import { BackendCoreStoreRepository } from "../src/modules/core-foundation/persistence/backend-core-store-repository";
import { PersistentBackendCoreServices } from "../src/modules/core-foundation/persistence/persistent-backend-core-services";

const postgresqlUrl = process.env.TEST_DATABASE_URL;

describe("transactional webhook Outbox", () => {
  it.runIf(postgresqlUrl)("emits controlled events only for persisted state changes", async () => {
    const url = requirePostgresqlUrl();
    await runPostgresqlMigrations({ url });
    await reset(url);
    const repository = BackendCoreStoreRepository.fromConfig({ dialect: "postgresql", url });
    const services = await PersistentBackendCoreServices.create(
      repository,
      { jwtSecret: "webhook-outbox-integration-secret" },
      { webhookEventsEnabled: true },
    );
    const app = createApp({ backendCoreServices: services });
    const pool = createPostgresqlPool(url);
    try {
      await initialize(app);
      const headers = await loginHeaders(app);
      const role = await requestData(app, "/api/roles", {
        method: "POST",
        headers,
        body: { name: "Webhook event role", code: "webhook_event_role" },
        expectedStatus: 201,
      });
      await requestData(app, `/api/roles/${role.id}/permissions`, {
        method: "PUT",
        headers,
        body: { permissionCodes: ["user:view"] },
      });
      await requestData(app, `/api/roles/${role.id}/permissions`, {
        method: "PUT",
        headers,
        body: { permissionCodes: ["user:view"] },
      });
      const user = await requestData(app, "/api/users", {
        method: "POST",
        headers,
        body: {
          username: "webhook-event-user",
          displayName: "Webhook Event User",
          email: "webhook-event-user@example.com",
          phone: "10000000009",
          password: "password1",
          primaryOrganizationId: "1",
          roleId: role.id,
        },
        expectedStatus: 201,
      });
      await requestData(app, `/api/users/${user.id}/organizations`, {
        method: "POST",
        headers,
        body: { organizationId: "1", roleId: role.id },
      });

      await requestData(app, "/api/permissions/sync", { method: "POST", headers });
      const beforeSecondSync = await outboxCount(pool);
      await requestData(app, "/api/permissions/sync", { method: "POST", headers });
      expect(await outboxCount(pool)).toBe(beforeSecondSync);

      const events = (
        await pool.query("SELECT event_type, payload_json FROM event_outbox ORDER BY id")
      ).rows;
      expect(events.filter((row) => row.event_type === "user.created")).toHaveLength(1);
      expect(
        events.filter((row) => row.payload_json?.data?.changeType === "rolePermissions"),
      ).toHaveLength(1);
      expect(
        events.filter((row) => row.payload_json?.data?.changeType === "roleBinding"),
      ).toHaveLength(0);
      expect(
        events.every((row) => ["user.created", "permission.changed"].includes(row.event_type)),
      ).toBe(true);
    } finally {
      await services.close();
      await pool.end();
      await reset(url);
    }
  });
});

async function initialize(app: ReturnType<typeof createApp>) {
  const response = await app.request("/api/initialization/setup", {
    method: "POST",
    body: JSON.stringify({
      organizationName: "Webhook Organization",
      organizationCode: "webhook",
      adminUsername: "webhook-admin",
      adminDisplayName: "Webhook Admin",
      adminEmail: "webhook-admin@example.com",
      adminPhone: "10000000008",
      adminPassword: "password1",
    }),
  });
  expect(response.status).toBe(201);
}

async function loginHeaders(app: ReturnType<typeof createApp>) {
  const response = await app.request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: "webhook-admin", password: "password1" }),
  });
  const body = await response.json();
  expect(response.status).toBe(200);
  return { authorization: `Bearer ${body.data.accessToken}` };
}

async function requestData(
  app: ReturnType<typeof createApp>,
  path: string,
  options: {
    body?: unknown;
    expectedStatus?: number;
    headers: Record<string, string>;
    method: string;
  },
) {
  const response = await app.request(path, {
    method: options.method,
    headers: {
      ...options.headers,
      ...(options.body ? { "content-type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json();
  expect(response.status).toBe(options.expectedStatus ?? 200);
  return payload.data;
}

async function outboxCount(pool: ReturnType<typeof createPostgresqlPool>) {
  return Number(
    (await pool.query("SELECT COUNT(*) AS count FROM event_outbox")).rows[0]?.count ?? 0,
  );
}

async function reset(url: string) {
  const repository = BackendCoreStoreRepository.fromConfig({ dialect: "postgresql", url });
  const pool = createPostgresqlPool(url);
  try {
    await pool.query("DELETE FROM webhook_delivery_attempts");
    await pool.query("DELETE FROM webhook_deliveries");
    await pool.query("DELETE FROM event_outbox");
    await repository.save(new InMemoryBackendStore());
  } finally {
    await repository.close();
    await pool.end();
  }
}

function requirePostgresqlUrl() {
  if (!postgresqlUrl) throw new Error("TEST_DATABASE_URL is required.");
  return postgresqlUrl;
}
