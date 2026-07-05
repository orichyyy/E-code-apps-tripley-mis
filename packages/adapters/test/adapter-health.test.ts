import { describe, expect, it } from "vitest";

import type { CacheAdapter } from "../src";

describe("adapter interfaces", () => {
  it("supports health checks on adapter contracts", async () => {
    const cache: CacheAdapter = {
      async healthCheck() {
        return { ok: true };
      },
      async get() {
        return null;
      },
      async set() {},
      async delete() {},
    };

    await expect(cache.healthCheck()).resolves.toEqual({ ok: true });
  });
});
