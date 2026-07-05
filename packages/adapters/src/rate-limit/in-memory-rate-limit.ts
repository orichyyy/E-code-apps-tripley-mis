import type { RateLimitAdapter } from ".";

type Counter = {
  count: number;
  resetAt: number;
};

export function createInMemoryRateLimitAdapter(): RateLimitAdapter {
  const counters = new Map<string, Counter>();

  return {
    async healthCheck() {
      return { ok: true };
    },
    async check(key, limit, windowSeconds) {
      const now = Date.now();
      const current = counters.get(key);
      const counter =
        !current || current.resetAt <= now
          ? { count: 0, resetAt: now + windowSeconds * 1000 }
          : current;

      counter.count += 1;
      counters.set(key, counter);

      return {
        allowed: counter.count <= limit,
        remaining: Math.max(0, limit - counter.count),
        resetAt: new Date(counter.resetAt).toISOString(),
      };
    },
  };
}
