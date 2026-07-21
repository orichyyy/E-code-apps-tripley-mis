import type { RateLimitAdapter } from ".";
import {
  closeRedisClient,
  createRedisClient,
  ensureRedisConnected,
  type RedisClient,
  type RedisConnectionOptions,
} from "../redis/client";

export type RedisRateLimitAdapter = RateLimitAdapter & {
  close: () => Promise<void>;
};

export type RedisRateLimitAdapterOptions = RedisConnectionOptions & {
  keyPrefix?: string;
};

export async function createRedisRateLimitAdapter(
  options: RedisRateLimitAdapterOptions,
): Promise<RedisRateLimitAdapter> {
  const client = await createRedisClient(options);
  return createRedisRateLimitAdapterFromClient(client, {
    keyPrefix: options.keyPrefix,
  });
}

export function createRedisRateLimitAdapterFromClient(
  client: RedisClient,
  options: { keyPrefix?: string } = {},
): RedisRateLimitAdapter {
  const keyPrefix = options.keyPrefix ?? "web-admin-base:rate-limit:";

  return {
    async check(key, limit, windowSeconds) {
      await ensureRedisConnected(client);
      const nowMs = Date.now();
      const windowStartMs = Math.floor(nowMs / (windowSeconds * 1000)) * windowSeconds * 1000;
      const resetAt = new Date(windowStartMs + windowSeconds * 1000).toISOString();
      const redisKey = `${keyPrefix}${key}:${windowStartMs}`;
      const count = Number(await client.sendCommand(["INCR", redisKey]));
      if (count === 1) {
        await client.sendCommand(["EXPIRE", redisKey, String(windowSeconds)]);
      }
      return {
        allowed: count <= limit,
        remaining: Math.max(limit - count, 0),
        resetAt,
      };
    },
    async healthCheck() {
      await ensureRedisConnected(client);
      await client.sendCommand(["PING"]);
      return { ok: true };
    },
    async close() {
      await closeRedisClient(client);
    },
  };
}
