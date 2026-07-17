import { z } from "zod";

import {
  loadFileStorageConfig,
  loadWebhookDeliveryConfig,
  type FileStorageConfig,
  type WebhookDeliveryConfig,
} from "@web-admin-base/adapters";
import { loadDatabaseConfig } from "@web-admin-base/db";

const optionalNonEmptyStringSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim().length === 0 ? null : value),
  z.string().min(1).nullable().default(null),
);

const workerConfigSchema = z.object({
  nodeEnv: z.enum(["development", "test", "demo", "production"]).default("development"),
  workerName: z.string().min(1).default("web-admin-base-worker"),
  pollIntervalMs: z.coerce.number().int().nonnegative().default(0),
  adapters: z
    .object({
      queueDriver: z.enum(["database", "rabbitmq"]).default("database"),
      rabbitMqUrl: optionalNonEmptyStringSchema.default(null),
    })
    .superRefine((adapters, context) => {
      if (adapters.queueDriver === "rabbitmq" && !adapters.rabbitMqUrl) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["rabbitMqUrl"],
          message: "RABBITMQ_URL is required when QUEUE_DRIVER=rabbitmq.",
        });
      }
    }),
});

export type WorkerConfig = z.infer<typeof workerConfigSchema> & {
  database: ReturnType<typeof loadDatabaseConfig>;
  storage: FileStorageConfig;
  webhook: WebhookDeliveryConfig;
};

export function loadWorkerConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  return {
    ...workerConfigSchema.parse({
      nodeEnv: env.NODE_ENV,
      workerName: env.WORKER_NAME,
      pollIntervalMs: env.WORKER_POLL_INTERVAL_MS,
      adapters: {
        queueDriver: env.QUEUE_DRIVER,
        rabbitMqUrl: env.RABBITMQ_URL,
      },
    }),
    database: loadDatabaseConfig(env),
    storage: loadFileStorageConfig(env),
    webhook: loadWebhookDeliveryConfig(env),
  };
}
