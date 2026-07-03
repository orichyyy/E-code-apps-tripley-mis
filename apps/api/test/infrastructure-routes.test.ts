import { describe, expect, it } from "vitest";

import { createApp } from "../src/app";

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
