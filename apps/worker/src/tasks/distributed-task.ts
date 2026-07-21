import type { LockAdapter } from "@web-admin-base/adapters";

export function withDistributedTaskLock(
  lock: LockAdapter,
  key: string,
  handler: () => Promise<void>,
  ttlSeconds = 15 * 60,
): () => Promise<void> {
  return async () => {
    const handle = await lock.acquire(key, { ttlSeconds });
    if (!handle) return;
    try {
      await handler();
    } finally {
      await handle.release();
    }
  };
}
