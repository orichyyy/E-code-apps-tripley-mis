import { describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  createInMemoryNotificationChannelAdapter,
  createLocalFileStorageAdapter
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
        variables: ["name"]
      })
    });
    const createTaskResponse = await app.request("/api/scheduled-tasks", {
      method: "POST",
      headers,
      body: JSON.stringify({
        code: "cleanup",
        cronExpression: "* * * * *",
        handlerType: "cleanup",
        payload: {},
        enabled: true
      })
    });
    const exportResponse = await app.request("/api/import-export/export", {
      method: "POST",
      headers,
      body: JSON.stringify({ resourceType: "logs:access" })
    });
    const logExportResponse = await app.request("/api/logs/export", {
      method: "POST",
      headers,
      body: JSON.stringify({ logType: "access" })
    });
    const lists = await Promise.all([
      app.request("/api/notification-templates", { headers }),
      app.request("/api/scheduled-tasks", { headers }),
      app.request("/api/import-export/tasks", { headers }),
      app.request("/api/logs/access", { headers }),
      app.request("/api/files", { headers }),
      app.request("/api/notifications", { headers })
    ]);

    expect(createTemplateResponse.status).toBe(201);
    expect(createTaskResponse.status).toBe(201);
    expect(exportResponse.status).toBe(201);
    expect(logExportResponse.status).toBe(201);
    for (const response of lists) expect(response.status).toBe(200);
    await expect(lists[0].json()).resolves.toEqual({
      data: [expect.objectContaining({ code: "welcome", locale: "en" })]
    });
  });

  it("uploads, downloads, previews, and lists file references", async () => {
    const root = await mkdtemp(join(tmpdir(), "web-admin-files-"));
    const app = createApp({
      backendCoreServices: createInMemoryBackendCoreServices(),
      infrastructureServices: InfrastructureServices.inMemory(createLocalFileStorageAdapter({ rootDirectory: root }))
    });

    try {
      await initialize(app);
      const headers = await loginHeaders(app);
      const textForm = new FormData();
      textForm.set("file", new File(["hello"], "report.txt", { type: "text/plain" }));
      const uploadResponse = await app.request("/api/files/upload", {
        method: "POST",
        headers,
        body: textForm
      });
      const uploadBody = await uploadResponse.json();
      const fileId = uploadBody.data.id;
      const downloadResponse = await app.request(`/api/files/${fileId}/download`, { headers });
      const referencesResponse = await app.request(`/api/files/${fileId}/references`, { headers });
      const imageForm = new FormData();
      imageForm.set("file", new File([new Uint8Array([137, 80, 78, 71])], "pixel.png", { type: "image/png" }));
      const imageUploadResponse = await app.request("/api/files/upload", {
        method: "POST",
        headers,
        body: imageForm
      });
      const imageUploadBody = await imageUploadResponse.json();
      const previewResponse = await app.request(`/api/files/${imageUploadBody.data.id}/preview`, { headers });

      expect(uploadResponse.status).toBe(201);
      expect(uploadBody.data).toEqual(expect.objectContaining({ originalName: "report.txt", extension: "txt" }));
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

  it("renders and sends test email notifications from templates", async () => {
    const notificationChannel = createInMemoryNotificationChannelAdapter();
    const app = createApp({
      backendCoreServices: createInMemoryBackendCoreServices(),
      infrastructureServices: InfrastructureServices.inMemory({ notificationChannel })
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
        variables: ["userName", "taskName"]
      })
    });
    const sendResponse = await app.request("/api/notifications/email/test", {
      method: "POST",
      headers,
      body: JSON.stringify({
        templateCode: "email-welcome",
        locale: "en",
        recipient: "ops@example.com",
        variables: { userName: "Ada", taskName: "Review" }
      })
    });
    const sendBody = await sendResponse.json();

    expect(createTemplateResponse.status).toBe(201);
    expect(sendResponse.status).toBe(200);
    expect(sendBody.data).toEqual(
      expect.objectContaining({
        channel: "email",
        recipient: "ops@example.com",
        subject: "Hello Ada",
        status: "sent"
      })
    );
    expect(notificationChannel.listMessages()).toEqual([
      expect.objectContaining({
        channel: "email",
        recipient: "ops@example.com",
        subject: "Hello Ada",
        body: "Task Review is ready."
      })
    ]);
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
      adminPassword: "password1"
    })
  });
  expect(response.status).toBe(201);
}

async function loginHeaders(app: ReturnType<typeof createApp>) {
  const response = await app.request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: "admin", password: "password1" })
  });
  const body = await response.json();
  expect(response.status).toBe(200);
  return {
    authorization: `Bearer ${body.data.accessToken}`
  };
}
