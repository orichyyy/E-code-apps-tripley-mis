import { randomUUID } from "node:crypto";

import type { LockAdapter, LockHandle } from ".";

type LockRecord = {
  owner: string;
  expiresAt: number;
};

export function createInMemoryLockAdapter(): LockAdapter {
  const locks = new Map<string, LockRecord>();

  return {
    async healthCheck() {
      return { ok: true };
    },
    async acquire(key, options = {}): Promise<LockHandle | null> {
      const now = Date.now();
      const current = locks.get(key);
      if (current && current.expiresAt > now) return null;

      const owner = randomUUID();
      locks.set(key, {
        owner,
        expiresAt: now + (options.ttlSeconds ?? 30) * 1000
      });

      return {
        key,
        async release() {
          if (locks.get(key)?.owner === owner) locks.delete(key);
        }
      };
    }
  };
}
