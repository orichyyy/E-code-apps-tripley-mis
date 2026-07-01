import { describe, expect, it } from "vitest";

import { createApp } from "../src/app";

describe("manifest routes", () => {
  it("exposes permission, route, and menu manifests", async () => {
    const app = createApp();
    await app.request("/api/initialization/setup", {
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
    const loginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "admin", password: "password1" })
    });
    const login = await loginResponse.json();
    const headers = { authorization: `Bearer ${login.data.accessToken}` };
    const permissions = await app.request("/api/permissions/manifest", { headers });
    const routes = await app.request("/api/routes/manifest", { headers });
    const menus = await app.request("/api/menus/tree", { headers });

    await expect(permissions.json()).resolves.toMatchObject({
      data: expect.arrayContaining([expect.objectContaining({ code: "user:view" })]),
      apiPermissions: expect.arrayContaining([
        expect.objectContaining({ code: "api.auth.login", path: "/api/auth/login" })
      ])
    });
    await expect(routes.json()).resolves.toMatchObject({
      data: expect.arrayContaining([expect.objectContaining({ routeCode: "system.users" })])
    });
    await expect(menus.json()).resolves.toMatchObject({
      data: expect.arrayContaining([expect.objectContaining({ code: "system.users" })])
    });
  });
});
