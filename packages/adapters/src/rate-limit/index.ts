import type { HealthCheckableAdapter } from "../health";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: string;
};

export type RateLimitAdapter = HealthCheckableAdapter & {
  check: (key: string, limit: number, windowSeconds: number) => Promise<RateLimitResult>;
};

export * from "./in-memory-rate-limit";
export * from "./database-rate-limit";
export * from "./redis-rate-limit";
