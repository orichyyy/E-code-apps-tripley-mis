import { describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  createInMemoryNotificationChannelAdapter,
  createLocalFileStorageAdapter,
  type FileStorageAdapter,
} from "@web-admin-base/adapters";
import { createApp } from "../src/app";
import { createInMemoryBackendCoreServices } from "../src/modules/core-foundation/services";
import { InfrastructureServices } from "../src/modules/infrastructure/infrastructure.service";

describe("infrastructure routes", () => {
  it("exposes implemented infrastructure APIs through authenticated base permissions", async () => {
    const app = createApp();
    await initialize(app);
    const headers = await loginHeaders(app);

    const createTemplateResponse = await app.request("/api/notification-templates", {
      method: "POST",
      headers,
      body: JSON.stringify({
        code: "welcome",
        channel: "in_app",
        locale: "en",
        subject: "Welcome",
        body: "Hello {{name}}",
        variables: ["name"],
      }),
    });
    const createTaskResponse = await app.request("/api/scheduled-tasks", {
      method: "POST",
      headers,
      body: JSON.stringify({
        code: "cleanup",
        cronExpression: "* * * * *",
        handlerType: "cleanup",
        payload: {},
        enabled: true,
      }),
    });
    const exportResponse = await app.request("/api/import-export/export", {
      method: "POST",
      headers,
      body: JSON.stringify({ resourceType: "logs:access" }),
    });
    const logExportResponse = await app.request("/api/logs/export", {
      method: "POST",
      headers,
      body: JSON.stringify({ logType: "access" }),
    });
    const lists = await Promise.all([
      app.request("/api/notification-templates", { headers }),
      app.request("/api/scheduled-tasks", { headers }),
      app.request("/api/import-export/tasks", { headers }),
      app.request("/api/logs/access", { headers }),
      app.request("/api/files", { headers }),
      app.request("/api/notifications", { headers }),
      app.request("/api/email-deliveries", { headers }),
    ]);

    expect(createTemplateResponse.status).toBe(201);
    expect(createTaskResponse.status).toBe(201);
    expect(exportResponse.status).toBe(201);
    expect(logExportResponse.status).toBe(201);
    for (const response of lists) expect(response.status).toBe(200);
    await expect(lists[0].json()).resolves.toEqual({
      data: [expect.objectContaining({ code: "welcome", locale: "en" })],
    });
  });

  it("uploads, downloads, previews, and lists file references", async () => {
    const root = await mkdtemp(join(tmpdir(), "web-admin-files-"));
    const app = createApp({
      backendCoreServices: createInMemoryBackendCoreServices(),
      infrastructureServices: InfrastructureServices.inMemory(
        createLocalFileStorageAdapter({ rootDirectory: root }),
      ),
    });

    try {
      await initialize(app);
      const headers = await loginHeaders(app);
      const textForm = new FormData();
      textForm.set("file", new File(["hello"], "report.txt", { type: "text/plain" }));
      const uploadResponse = await app.request("/api/files/upload", {
        method: "POST",
        headers,
        body: textForm,
      });
      const uploadBody = await uploadResponse.json();
      const fileId = uploadBody.data.id;
      const downloadResponse = await app.request(`/api/files/${fileId}/download`, { headers });
      const referencesResponse = await app.request(`/api/files/${fileId}/references`, { headers });
      const imageForm = new FormData();
      imageForm.set(
        "file",
        new File([new Uint8Array([137, 80, 78, 71])], "pixel.png", { type: "image/png" }),
      );
      const imageUploadResponse = await app.request("/api/files/upload", {
        method: "POST",
        headers,
        body: imageForm,
      });
      const imageUploadBody = await imageUploadResponse.json();
      const previewResponse = await app.request(`/api/files/${imageUploadBody.data.id}/preview`, {
        headers,
      });

      expect(uploadResponse.status).toBe(201);
      expect(uploadBody.data).toEqual(
        expect.objectContaining({ originalName: "report.txt", extension: "txt" }),
      );
      expect(downloadResponse.status).toBe(200);
      await expect(downloadResponse.text()).resolves.toBe("hello");
      expect(downloadResponse.headers.get("content-disposition")).toContain("report.txt");
      expect(referencesResponse.status).toBe(200);
      await expect(referencesResponse.json()).resolves.toEqual({ data: [] });
      expect(previewResponse.status).toBe(200);
      expect(previewResponse.headers.get("content-type")).toBe("image/png");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("authorizes private S3 downloads before issuing short-lived redirects", async () => {
    const storage = createTestS3Storage();
    const app = createApp({
      backendCoreServices: createInMemoryBackendCoreServices(),
      infrastructureServices: InfrastructureServices.inMemory({ storage }),
    });
    await initialize(app);

    const unauthorized = await app.request("/api/files/1/download");
    expect(unauthorized.status).toBe(401);
    expect(storage.signedLocations).toEqual([]);

    const headers = await loginHeaders(app);
    const form = new FormData();
    form.set("file", new File(["private"], "private.txt", { type: "text/plain" }));
    const uploadResponse = await app.request("/api/files/upload", {
      method: "POST",
      headers,
      body: form,
    });
    const uploaded = (await uploadResponse.json()).data;
    const downloadResponse = await app.request(`/api/files/${uploaded.id}/download`, { headers });

    expect(uploaded).toEqual(
      expect.objectContaining({ storageDriver: "s3", storageBucket: "admin-files" }),
    );
    expect(JSON.stringify(uploaded)).not.toContain("X-Amz-");
    expect(downloadResponse.status).toBe(302);
    expect(downloadResponse.headers.get("location")).toBe(
      `http://storage.test/admin-files/${uploaded.objectKey}?X-Amz-Signature=masked`,
    );
    expect(storage.signedLocations).toEqual([
      expect.objectContaining({ storageDriver: "s3", storageBucket: "admin-files" }),
    ]);
    expect(storage.signedTtls).toEqual([60]);

    await app.request(`/api/files/${uploaded.id}`, { method: "DELETE", headers });
    const invalidDownload = await app.request(`/api/files/${uploaded.id}/download`, { headers });
    expect(invalidDownload.status).toBe(404);
    expect(storage.signedLocations).toHaveLength(1);
  });

  it("renders and sends test email notifications from templates", async () => {
    const notificationChannel = createInMemoryNotificationChannelAdapter();
    const app = createApp({
      backendCoreServices: createInMemoryBackendCoreServices(),
      infrastructureServices: InfrastructureServices.inMemory({ notificationChannel }),
    });
    await initialize(app);
    const headers = await loginHeaders(app);

    const createTemplateResponse = await app.request("/api/notification-templates", {
      method: "POST",
      headers,
      body: JSON.stringify({
        code: "email-welcome",
        channel: "email",
        locale: "en",
        subject: "Hello {userName}",
        body: "Task {{taskName}} is ready.",
        variables: ["userName", "taskName"],
      }),
    });
    const sendResponse = await app.request("/api/notifications/email/test", {
      method: "POST",
      headers,
      body: JSON.stringify({
        templateCode: "email-welcome",
        locale: "en",
        recipient: "ops@example.com",
        variables: { userName: "Ada", taskName: "Review" },
      }),
    });
    const sendBody = await sendResponse.json();

    expect(createTemplateResponse.status).toBe(201);
    expect(sendResponse.status).toBe(200);
    expect(sendBody.data).toEqual(
      expect.objectContaining({
        channel: "email",
        recipient: "ops@example.com",
        subject: "Hello Ada",
        status: "sent",
      }),
    );
    expect(notificationChannel.listMessages()).toEqual([
      expect.objectContaining({
        channel: "email",
        recipient: "ops@example.com",
        subject: "Hello Ada",
        body: "Task Review is ready.",
      }),
    ]);
  });

  it("rejects invalid scheduled-task cron expressions as validation errors", async () => {
    const app = createApp();
    await initialize(app);
    const headers = await loginHeaders(app);

    const response = await app.request("/api/scheduled-tasks", {
      method: "POST",
      headers,
      body: JSON.stringify({
        code: "invalid-cron",
        cronExpression: "not-a-cron",
        handlerType: "cleanup",
        payload: {},
        enabled: true,
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toEqual(expect.objectContaining({ code: "VALIDATION_INVALID_REQUEST" }));
  });
});

function createTestS3Storage(): FileStorageAdapter & {
  signedLocations: Parameters<FileStorageAdapter["get"]>[0][];
  signedTtls: number[];
} {
  const objects = new Map<string, Uint8Array>();
  const signedLocations: Parameters<FileStorageAdapter["get"]>[0][] = [];
  const signedTtls: number[] = [];
  return {
    storageDriver: "s3",
    signedLocations,
    signedTtls,
    async healthCheck() {
      return { ok: true };
    },
    async put(objectKey, body, contentType) {
      const completeKey = objectKey.replace(/^uploads\/\d{4}\/\d{2}\//, "");
      objects.set(completeKey, body.slice());
      return {
        storageDriver: "s3",
        storageBucket: "admin-files",
        objectKey: completeKey,
        contentType,
        sizeBytes: body.byteLength,
      };
    },
    async get(location) {
      return objects.get(location.objectKey)?.slice() ?? null;
    },
    async delete(location) {
      objects.delete(location.objectKey);
    },
    async createDownloadUrl(location, options) {
      signedLocations.push(location);
      signedTtls.push(options.expiresInSeconds);
      return {
        url: `http://storage.test/${location.storageBucket}/${location.objectKey}?X-Amz-Signature=masked`,
        expiresAt: new Date(Date.now() + options.expiresInSeconds * 1000),
      };
    },
  };
}

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
  return {
    authorization: `Bearer ${body.data.accessToken}`,
  };
}
