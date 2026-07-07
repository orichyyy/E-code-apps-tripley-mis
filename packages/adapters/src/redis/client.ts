type RedisModule = typeof import("redis");

export type RedisClient = {
  connect: () => Promise<unknown>;
  sendCommand: (args: string[]) => Promise<unknown>;
  isOpen?: boolean;
  close?: () => Promise<unknown>;
  quit?: () => Promise<unknown>;
};

export type RedisConnectionOptions = {
  url: string;
};

export async function createRedisClient(options: RedisConnectionOptions): Promise<RedisClient> {
  const redis = (await import("redis")) as RedisModule;
  return redis.createClient({ url: options.url }) as RedisClient;
}

export async function ensureRedisConnected(client: RedisClient): Promise<void> {
  if (client.isOpen) return;
  await client.connect();
}

export async function closeRedisClient(client: RedisClient): Promise<void> {
  if (!client.isOpen) return;
  if (client.close) {
    await client.close();
    return;
  }
  await client.quit?.();
}

export function parseRedisJson<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  const text = typeof value === "string" ? value : String(value);
  return JSON.parse(text) as T;
}
