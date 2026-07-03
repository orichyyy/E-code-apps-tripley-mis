import { z } from "zod";

import { loadDatabaseConfig } from "@web-admin-base/db";

const workerConfigSchema = z.object({
  nodeEnv: z.enum(["development", "test", "demo", "production"]).default("development"),
  workerName: z.string().min(1).default("web-admin-base-worker"),
  pollIntervalMs: z.coerce.number().int().nonnegative().default(0)
});

export type WorkerConfig = z.infer<typeof workerConfigSchema> & {
  database: ReturnType<typeof loadDatabaseConfig>;
};

export function loadWorkerConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  return {
    ...workerConfigSchema.parse({
      nodeEnv: env.NODE_ENV,
      workerName: env.WORKER_NAME,
      pollIntervalMs: env.WORKER_POLL_INTERVAL_MS
    }),
    database: loadDatabaseConfig(env)
  };
}
