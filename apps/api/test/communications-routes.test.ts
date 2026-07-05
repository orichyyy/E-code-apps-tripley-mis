import { describe, expect, it } from "vitest";

import { createApp } from "../src/app";

describe("communications routes", () => {
  it("exposes announcement and webhook subscription APIs through authenticated base permissions", async () => {
    const app = createApp();
    await initialize(app);
    const headers = await loginHeaders(app);

    const announcementResponse = await app.request("/api/announcements", {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: "Maintenance",
        content: "Scheduled maintenance window",
        scopeType: "system",
      }),
    });
    const announcementBody = await announcementResponse.json();
    const updateAnnouncementResponse = await app.request(
      `/api/announcements/${announcementBody.data.id}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({ title: "Maintenance Updated" }),
      },
    );
    const publishResponse = await app.request(
      `/api/announcements/${announcementBody.data.id}/publish`,
      {
        method: "POST",
        headers,
      },
    );
    const unpublishResponse = await app.request(
      `/api/announcements/${announcementBody.data.id}/unpublish`,
      {
        method: "POST",
        headers,
      },
    );
    const webhookResponse = await app.request("/api/webhooks", {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "Audit webhook",
        url: "https://example.com/webhook",
        eventTypes: ["security.event"],
        secret: "top-secret",
        status: "enabled",
      }),
    });
    const webhookBody = await webhookResponse.json();
    const updateWebhookResponse = await app.request(`/api/webhooks/${webhookBody.data.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "disabled" }),
    });
    const listResponses = await Promise.all([
      app.request("/api/announcements", { headers }),
      app.request("/api/webhooks", { headers }),
    ]);

    expect(announcementResponse.status).toBe(201);
    expect(updateAnnouncementResponse.status).toBe(200);
    expect(publishResponse.status).toBe(200);
    await expect(publishResponse.json()).resolves.toEqual({
      data: expect.objectContaining({ id: announcementBody.data.id, status: "published" }),
    });
    expect(unpublishResponse.status).toBe(200);
    await expect(unpublishResponse.json()).resolves.toEqual({
      data: expect.objectContaining({
        id: announcementBody.data.id,
        status: "draft",
        publishedAt: null,
      }),
    });
    expect(webhookResponse.status).toBe(201);
    expect(webhookBody.data).toEqual(
      expect.objectContaining({
        name: "Audit webhook",
        eventTypes: ["security.event"],
        secretConfigured: true,
        status: "enabled",
      }),
    );
    expect(webhookBody.data).not.toHaveProperty("secret");
    expect(updateWebhookResponse.status).toBe(200);
    await expect(updateWebhookResponse.json()).resolves.toEqual({
      data: expect.objectContaining({
        id: webhookBody.data.id,
        status: "disabled",
        secretConfigured: true,
      }),
    });
    for (const response of listResponses) expect(response.status).toBe(200);
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
