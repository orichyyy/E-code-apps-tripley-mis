import type { DatabaseAdapterExecutor } from "@web-admin-base/adapters";
import {
  createInMemoryNotificationChannelAdapter,
  createLocalFileStorageAdapter,
} from "@web-admin-base/adapters";
import { runPostgresqlMigrations } from "@web-admin-base/db";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app";
import { createInMemoryBackendCoreServices } from "../src/modules/core-foundation/services";
import { createPostgresqlInfrastructureExecutor } from "../src/modules/infrastructure/infrastructure.executor";
import { InfrastructureRepository } from "../src/modules/infrastructure/infrastructure.repository";
import { InfrastructureServices } from "../src/modules/infrastructure/infrastructure.service";

const postgresqlUrl = process.env.TEST_DATABASE_URL;

describe("database-backed infrastructure routes", () => {
  it.runIf(postgresqlUrl)("persists infrastructure API mutations in PostgreSQL", async () => {
    const url = getPostgresqlUrl();
    await runPostgresqlMigrations({ url });
    const executor = createPostgresqlInfrastructureExecutor(url);
    const root = await mkdtemp(join(tmpdir(), "web-admin-files-db-"));
    const notificationChannel = createInMemoryNotificationChannelAdapter();
    const infrastructureServices = InfrastructureServices.database(
      new InfrastructureRepository(executor),
      {
        storage: createLocalFileStorageAdapter({ rootDirectory: root }),
        notificationChannel,
      },
    );
    const app = createApp({
      infrastructureServices,
      backendCoreServices: createInMemoryBackendCoreServices(),
    });

    try {
      await clearInfrastructureTables(executor);
      await initialize(app);
      const headers = await loginHeaders(app);
      const createResponse = await app.request("/api/notification-templates", {
        method: "POST",
        headers,
        body: JSON.stringify({
          code: "db-template",
          channel: "in_app",
          locale: "en",
          body: "Body",
          variables: [],
        }),
      });
      const listResponse = await app.request("/api/notification-templates", { headers });
      const taskResponse = await app.request("/api/import-export/export", {
        method: "POST",
        headers,
        body: JSON.stringify({ resourceType: "logs:security" }),
      });
      const emailTemplateResponse = await app.request("/api/notification-templates", {
        method: "POST",
        headers,
        body: JSON.stringify({
          code: "db-email-template",
          channel: "email",
          locale: "en",
          subject: "Hello {name}",
          body: "Body for {{name}}",
          variables: ["name"],
        }),
      });
      const sendEmailResponse = await app.request("/api/notifications/email/test", {
        method: "POST",
        headers,
        body: JSON.stringify({
          templateCode: "db-email-template",
          locale: "en",
          recipient: "ops@example.com",
          variables: { name: "Ada" },
        }),
      });
      const persisted = await executor.all(
        "SELECT code FROM notification_templates WHERE code = $1",
        ["db-template"],
      );

      expect(createResponse.status).toBe(201);
      expect(listResponse.status).toBe(200);
      expect(taskResponse.status).toBe(201);
      expect(emailTemplateResponse.status).toBe(201);
      expect(sendEmailResponse.status).toBe(200);
      expect(notificationChannel.listMessages()).toEqual([
        expect.objectContaining({
          channel: "email",
          recipient: "ops@example.com",
          subject: "Hello Ada",
          body: "Body for Ada",
        }),
      ]);
      expect(persisted).toEqual([expect.objectContaining({ code: "db-template" })]);

      const form = new FormData();
      form.set("file", new File(["db-file"], "db-file.csv", { type: "text/csv" }));
      const uploadResponse = await app.request("/api/files/upload", {
        method: "POST",
        headers,
        body: form,
      });
      const uploadBody = await uploadResponse.json();
      const storedFiles = await executor.all(
        "SELECT original_name, content_type FROM file_objects WHERE id = $1",
        [uploadBody.data.id],
      );
      const downloadResponse = await app.request(`/api/files/${uploadBody.data.id}/download`, {
        headers,
      });

      expect(uploadResponse.status).toBe(201);
      expect(storedFiles).toEqual([
        expect.objectContaining({ original_name: "db-file.csv", content_type: "text/csv" }),
      ]);
      await expect(downloadResponse.text()).resolves.toBe("db-file");
    } finally {
      await clearInfrastructureTables(executor);
      await infrastructureServices.close();
      await rm(root, { recursive: true, force: true });
    }
  });
});

async function initialize(app: ReturnType<typeof createApp>): Promise<void> {
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
  expect(response.status).toBe(201);
}

async function loginHeaders(app: ReturnType<typeof createApp>) {
  const response = await app.request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: "admin", password: "password1" }),
  });
  const body = await response.json();
  expect(response.status).toBe(200);
  return { authorization: `Bearer ${body.data.accessToken}` };
}

async function clearInfrastructureTables(executor: DatabaseAdapterExecutor): Promise<void> {
  for (const table of [
    "file_references",
    "notification_templates",
    "notifications",
    "import_export_tasks",
    "queue_jobs",
    "scheduled_jobs",
    "file_objects",
    "log_entries",
  ]) {
    await executor.run(`DELETE FROM ${table}`);
  }
}

function getPostgresqlUrl(): string {
  if (!postgresqlUrl) throw new Error("TEST_DATABASE_URL is required for PostgreSQL API tests.");
  return postgresqlUrl;
}
