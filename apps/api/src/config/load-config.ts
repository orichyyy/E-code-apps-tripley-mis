import { z } from "zod";

const apiConfigSchema = z.object({
  nodeEnv: z.enum(["development", "test", "demo", "production"]).default("development"),
  port: z.coerce.number().int().positive().default(3000)
});

export type ApiConfig = z.infer<typeof apiConfigSchema>;

export function loadApiConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  return apiConfigSchema.parse({
    nodeEnv: env.NODE_ENV,
    port: env.API_PORT
  });
}
