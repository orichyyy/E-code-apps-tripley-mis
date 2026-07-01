import { describe, expect, it } from "vitest";

import { createInMemoryCacheAdapter } from "../src";

describe("createInMemoryCacheAdapter", () => {
  it("stores, reads, and deletes values", async () => {
    const cache = createInMemoryCacheAdapter();

    await cache.set("key", { value: 1 });

    await expect(cache.get("key")).resolves.toEqual({ value: 1 });
    await cache.delete("key");
    await expect(cache.get("key")).resolves.toBeNull();
  });
});
