import { createInMemoryCacheAdapter } from "@web-admin-base/adapters";
import { describe, expect, it } from "vitest";

import { PermissionCache } from "../src/modules/permissions/permission-cache";

describe("permission cache", () => {
  it("stores and invalidates permission contexts", async () => {
    const cache = new PermissionCache(createInMemoryCacheAdapter());

    await cache.set({
      userId: "1",
      organizationId: "2",
      permissionCodes: ["user:view"],
    });

    await expect(cache.get("1", "2")).resolves.toMatchObject({
      permissionCodes: ["user:view"],
    });

    await cache.invalidate("1", "2");
    await expect(cache.get("1", "2")).resolves.toBeNull();
  });
});
