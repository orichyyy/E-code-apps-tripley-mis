import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createRedisCacheAdapter, createRedisRateLimitAdapter } from "../src";

const redisUrl = process.env.REDIS_URL;

describe.runIf(redisUrl)("Redis infrastructure adapters", () => {
  it("stores cache values and enforces rate-limit windows", async () => {
    const keyPrefix = `web-admin-base:test:${randomUUID()}:`;
    const cache = await createRedisCacheAdapter({
      url: getRedisUrl(),
      keyPrefix: `${keyPrefix}cache:`,
    });
    const rateLimit = await createRedisRateLimitAdapter({
      url: getRedisUrl(),
      keyPrefix: `${keyPrefix}rate-limit:`,
    });

    try {
      await cache.set("settings", { locale: "en" }, { ttlSeconds: 30 });
      await expect(cache.get("settings")).resolves.toEqual({ locale: "en" });
      await cache.delete("settings");
      await expect(cache.get("settings")).resolves.toBeNull();

      await expect(rateLimit.check("login:admin", 2, 60)).resolves.toMatchObject({
        allowed: true,
        remaining: 1,
      });
      await expect(rateLimit.check("login:admin", 2, 60)).resolves.toMatchObject({
        allowed: true,
        remaining: 0,
      });
      await expect(rateLimit.check("login:admin", 2, 60)).resolves.toMatchObject({
        allowed: false,
        remaining: 0,
      });

      await expect(cache.healthCheck()).resolves.toEqual({ ok: true });
      await expect(rateLimit.healthCheck()).resolves.toEqual({ ok: true });
    } finally {
      await cache.close();
      await rateLimit.close();
    }
  });
});

function getRedisUrl(): string {
  if (!redisUrl) throw new Error("REDIS_URL is required for Redis integration tests.");
  return redisUrl;
}
