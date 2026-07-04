import type { DatabaseAdapterExecutor } from "@web-admin-base/adapters";

import { now, p } from "./db-utils";
import { writeWorkerTaskLog } from "./task-log";

const logTypes = [
  "login",
  "operation",
  "access",
  "api_call",
  "exception",
  "security",
  "scheduler",
  "file_operation"
] as const;

export const logRetentionTaskCode = "base.logs.retention";
export const defaultLogRetentionDays = 90;

export function createLogRetentionTaskHandler(executor: DatabaseAdapterExecutor) {
  return async (): Promise<void> => {
    let deleted = 0;
    const cutoff = new Date(Date.now() - defaultLogRetentionDays * 24 * 60 * 60 * 1000).toISOString();
    for (const logType of logTypes) {
      const rows = await executor.all(
        `SELECT COUNT(*) AS count FROM log_entries WHERE log_type = ${p(executor, 1)} AND occurred_at < ${p(executor, 2)}`,
        [logType, cutoff]
      );
      deleted += Number(rows[0]?.count ?? 0);
      await executor.run(
        `DELETE FROM log_entries WHERE log_type = ${p(executor, 1)} AND occurred_at < ${p(executor, 2)}`,
        [logType, cutoff]
      );
    }
    await writeWorkerTaskLog(executor, {
      level: "info",
      message: "Log retention cleanup completed",
      taskCode: logRetentionTaskCode,
      metadata: { deleted, retentionDays: defaultLogRetentionDays, cutoff, completedAt: now() }
    });
  };
}
