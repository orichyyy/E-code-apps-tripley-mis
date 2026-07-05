import type { CacheAdapter } from ".";

type CacheEntry = {
  value: unknown;
  expiresAt?: number;
};

export function createInMemoryCacheAdapter(): CacheAdapter {
  const entries = new Map<string, CacheEntry>();

  return {
    async healthCheck() {
      return { ok: true };
    },
    async get<T>(key: string): Promise<T | null> {
      const entry = entries.get(key);
      if (!entry) {
        return null;
      }

      if (entry.expiresAt && entry.expiresAt <= Date.now()) {
        entries.delete(key);
        return null;
      }

      return entry.value as T;
    },
    async set<T>(key: string, value: T, options?: { ttlSeconds?: number }) {
      entries.set(key, {
        value,
        expiresAt: options?.ttlSeconds ? Date.now() + options.ttlSeconds * 1000 : undefined,
      });
    },
    async delete(key: string) {
      entries.delete(key);
    },
  };
}
