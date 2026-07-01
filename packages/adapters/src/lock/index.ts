import type { HealthCheckableAdapter } from "../health";

export type LockHandle = {
  key: string;
  release: () => Promise<void>;
};

export type LockAdapter = HealthCheckableAdapter & {
  acquire: (key: string, options?: { ttlSeconds?: number }) => Promise<LockHandle | null>;
};
