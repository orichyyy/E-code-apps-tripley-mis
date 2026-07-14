import type { DatabaseAdapterExecutor, FileStorageAdapter } from "@web-admin-base/adapters";
import {
  createInMemoryNotificationChannelAdapter,
  createLocalFileStorageAdapter,
  createRoutedFileStorageAdapter,
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
    const localStorage = createLocalFileStorageAdapter({ rootDirectory: root });
    const s3Storage = createTestS3Storage();
    const infrastructureServices = InfrastructureServices.database(
      new InfrastructureRepository(executor),
      {
        storage: createRoutedFileStorageAdapter({
          activeDriver: "local",
          adapters: [localStorage, s3Storage],
        }),
        notificationChannel,
      },
    );
    const backendCoreServices = createInMemoryBackendCoreServices();
    const app = createApp({
      infrastructureServices,
      backendCoreServices,
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
        "SELECT original_name, content_type, storage_driver, storage_bucket, content_deleted_at FROM file_objects WHERE id = $1",
        [uploadBody.data.id],
      );
      const downloadResponse = await app.request(`/api/files/${uploadBody.data.id}/download`, {
        headers,
      });

      expect(uploadResponse.status).toBe(201);
      expect(storedFiles).toEqual([
        expect.objectContaining({
          original_name: "db-file.csv",
          content_type: "text/csv",
          storage_driver: "local",
          storage_bucket: null,
          content_deleted_at: null,
        }),
      ]);
      await expect(downloadResponse.text()).resolves.toBe("db-file");

      const s3Services = InfrastructureServices.database(new InfrastructureRepository(executor), {
        storage: createRoutedFileStorageAdapter({
          activeDriver: "s3",
          adapters: [localStorage, s3Storage],
        }),
      });
      const s3App = createApp({ infrastructureServices: s3Services, backendCoreServices });
      const s3Form = new FormData();
      s3Form.set("file", new File(["s3-file"], "s3-file.csv", { type: "text/csv" }));
      const s3Upload = await s3App.request("/api/files/upload", {
        method: "POST",
        headers,
        body: s3Form,
      });
      const s3Body = await s3Upload.json();
      const persistedS3 = await executor.all(
        "SELECT storage_driver, storage_bucket, object_key FROM file_objects WHERE id = $1",
        [s3Body.data.id],
      );
      const historicalDownload = await app.request(`/api/files/${s3Body.data.id}/download`, {
        headers,
      });

      expect(s3Upload.status).toBe(201);
      expect(persistedS3).toEqual([
        expect.objectContaining({ storage_driver: "s3", storage_bucket: "admin-files" }),
      ]);
      expect(historicalDownload.status).toBe(302);
      expect(historicalDownload.headers.get("location")).toContain("storage.test/admin-files/");
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

function createTestS3Storage(): FileStorageAdapter {
  const objects = new Map<string, Uint8Array>();
  return {
    storageDriver: "s3",
    healthCheck: async () => ({ ok: true }),
    put: async (objectKey, body, contentType) => {
      objects.set(objectKey, body.slice());
      return {
        storageDriver: "s3",
        storageBucket: "admin-files",
        objectKey,
        contentType,
        sizeBytes: body.byteLength,
      };
    },
    get: async (location) => objects.get(location.objectKey)?.slice() ?? null,
    delete: async (location) => {
      objects.delete(location.objectKey);
    },
    createDownloadUrl: async (location) => ({
      url: `http://storage.test/${location.storageBucket}/${location.objectKey}`,
      expiresAt: new Date(Date.now() + 60_000),
    }),
  };
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
