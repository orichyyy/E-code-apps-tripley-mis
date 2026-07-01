import type { HealthCheckableAdapter } from "../health";

export type CacheAdapter = HealthCheckableAdapter & {
  get: <T>(key: string) => Promise<T | null>;
  set: <T>(key: string, value: T, options?: { ttlSeconds?: number }) => Promise<void>;
  delete: (key: string) => Promise<void>;
};
