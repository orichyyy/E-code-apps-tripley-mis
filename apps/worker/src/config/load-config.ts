import { z } from "zod";

const workerConfigSchema = z.object({
  nodeEnv: z.enum(["development", "test", "demo", "production"]).default("development"),
  workerName: z.string().min(1).default("web-admin-base-worker")
});

export type WorkerConfig = z.infer<typeof workerConfigSchema>;

export function loadWorkerConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  return workerConfigSchema.parse({
    nodeEnv: env.NODE_ENV,
    workerName: env.WORKER_NAME
  });
}
