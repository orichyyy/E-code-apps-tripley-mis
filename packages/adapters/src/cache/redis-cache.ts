import type { CacheAdapter } from ".";
import {
  closeRedisClient,
  createRedisClient,
  ensureRedisConnected,
  parseRedisJson,
  type RedisClient,
  type RedisConnectionOptions,
} from "../redis/client";

export type RedisCacheAdapter = CacheAdapter & {
  close: () => Promise<void>;
};

export type RedisCacheAdapterOptions = RedisConnectionOptions & {
  keyPrefix?: string;
};

export async function createRedisCacheAdapter(
  options: RedisCacheAdapterOptions,
): Promise<RedisCacheAdapter> {
  const client = await createRedisClient(options);
  const keyPrefix = options.keyPrefix ?? "web-admin-base:cache:";

  return createRedisCacheAdapterFromClient(client, { keyPrefix });
}

export function createRedisCacheAdapterFromClient(
  client: RedisClient,
  options: { keyPrefix?: string } = {},
): RedisCacheAdapter {
  const keyPrefix = options.keyPrefix ?? "web-admin-base:cache:";

  return {
    async get<T>(key: string): Promise<T | null> {
      await ensureRedisConnected(client);
      return parseRedisJson<T>(await client.sendCommand(["GET", withPrefix(keyPrefix, key)]));
    },
    async set<T>(key: string, value: T, options?: { ttlSeconds?: number }): Promise<void> {
      await ensureRedisConnected(client);
      const redisKey = withPrefix(keyPrefix, key);
      const serialized = JSON.stringify(value);
      if (options?.ttlSeconds) {
        await client.sendCommand(["SET", redisKey, serialized, "EX", String(options.ttlSeconds)]);
        return;
      }
      await client.sendCommand(["SET", redisKey, serialized]);
    },
    async delete(key: string): Promise<void> {
      await ensureRedisConnected(client);
      await client.sendCommand(["DEL", withPrefix(keyPrefix, key)]);
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

function withPrefix(prefix: string, key: string): string {
  return `${prefix}${key}`;
}
