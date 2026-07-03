import { describe, expect, it } from "vitest";

import { createApp } from "../src/app";

describe("system management routes", () => {
  it("exposes system config, dictionary, and i18n APIs through authenticated base permissions", async () => {
    const app = createApp();
    await initialize(app);
    const headers = await loginHeaders(app);

    const createTypeResponse = await app.request("/api/dictionary-types", {
      method: "POST",
      headers,
      body: JSON.stringify({
        code: "base_status",
        name: "Base status",
        description: "Global dictionary",
        status: "enabled"
      })
    });
    const typeBody = await createTypeResponse.json();
    const createItemResponse = await app.request(`/api/dictionary-types/${typeBody.data.id}/items`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        itemValue: "enabled",
        labelI18nKey: "dictionary.base_status.enabled",
        sortOrder: 1,
        status: "enabled"
      })
    });
    const lists = await Promise.all([
      app.request("/api/system-config", { headers }),
      app.request("/api/dictionary-types", { headers }),
      app.request(`/api/dictionary-types/${typeBody.data.id}/items`, { headers }),
      app.request("/api/i18n/messages", { headers })
    ]);

    expect(createTypeResponse.status).toBe(201);
    expect(createItemResponse.status).toBe(201);
    for (const response of lists) expect(response.status).toBe(200);
    await expect(lists[1].json()).resolves.toEqual({
      data: [expect.objectContaining({ code: "base_status", name: "Base status" })]
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
