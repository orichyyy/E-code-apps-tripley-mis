import { describe, expect, it } from "vitest";

import { createApp } from "../src/app";

describe("manifest routes", () => {
  it("exposes permission, route, and menu manifests", async () => {
    const app = createApp();
    const permissions = await app.request("/api/permissions/manifest");
    const routes = await app.request("/api/routes/manifest");
    const menus = await app.request("/api/menus/tree");

    await expect(permissions.json()).resolves.toMatchObject({
      data: expect.arrayContaining([expect.objectContaining({ code: "user:view" })])
    });
    await expect(routes.json()).resolves.toMatchObject({
      data: expect.arrayContaining([expect.objectContaining({ routeCode: "system.users" })])
    });
    await expect(menus.json()).resolves.toMatchObject({
      data: expect.arrayContaining([expect.objectContaining({ code: "system.users" })])
    });
  });
});
