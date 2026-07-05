import type { DatabaseAdapterExecutor } from "@web-admin-base/adapters";

import { json, now, p } from "./db-utils";

export type WorkerTaskLogInput = {
  level: "info" | "warn" | "error";
  message: string;
  taskCode: string;
  metadata?: Record<string, unknown>;
};

export async function writeWorkerTaskLog(
  executor: DatabaseAdapterExecutor,
  input: WorkerTaskLogInput,
): Promise<void> {
  const occurredAt = now();
  await executor.run(
    `INSERT INTO log_entries (log_type, level, message, metadata_json, occurred_at, created_at)
     VALUES ('scheduler', ${p(executor, 1)}, ${p(executor, 2)}, ${p(executor, 3)}, ${p(executor, 4)}, ${p(executor, 5)})`,
    [
      input.level,
      input.message,
      json(executor, { taskCode: input.taskCode, ...input.metadata }),
      occurredAt,
      occurredAt,
    ],
  );
}
