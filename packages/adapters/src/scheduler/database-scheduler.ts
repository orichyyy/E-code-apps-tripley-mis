import type { JobSchedulerAdapter, ScheduledJobDefinition } from ".";
import type { DatabaseAdapterExecutor, DatabaseRow } from "../database/executor";
import { jsonParam, nowIso, readJson } from "../database/executor";

export type ScheduledJobRecord<TPayload = unknown> = ScheduledJobDefinition & {
  id: string;
  handlerType: string;
  payload: TPayload;
};

export type DatabaseJobSchedulerAdapter = JobSchedulerAdapter & {
  processDue: (limit?: number) => Promise<number>;
};

type Handler = (job: ScheduledJobRecord) => Promise<void>;

export function createDatabaseJobSchedulerAdapter(executor: DatabaseAdapterExecutor): DatabaseJobSchedulerAdapter {
  const handlers = new Map<string, Handler>();

  return {
    async register(job, handler) {
      handlers.set(job.code, handler as Handler);
      const now = nowIso();
      await executor.run(
        upsertSql(executor.dialect),
        [job.code, job.cronExpression, job.code, jsonParam({}, executor.dialect), job.enabled ? "enabled" : "disabled", now, now, now]
      );
    },
    async unregister(jobCode) {
      handlers.delete(jobCode);
      await executor.run(`UPDATE scheduled_jobs SET status = 'disabled', updated_at = ${p(executor, 1)} WHERE code = ${p(executor, 2)}`, [
        nowIso(),
        jobCode
      ]);
    },
    async processDue(limit = 10) {
      const rows = await executor.all(
        `SELECT id, code, cron_expression, handler_type, payload_json, status FROM scheduled_jobs
         WHERE status = 'enabled' AND (next_run_at IS NULL OR next_run_at <= ${p(executor, 1)})
         ORDER BY id ASC LIMIT ${Number(limit)}`,
        [nowIso()]
      );
      let processed = 0;
      for (const row of rows) {
        const job = toScheduledJob(row);
        const handler = handlers.get(job.handlerType) ?? handlers.get(job.code);
        if (!handler) continue;
        try {
          await handler(job);
          await executor.run(
            `UPDATE scheduled_jobs SET last_run_at = ${p(executor, 1)}, next_run_at = NULL, attempt = 0, last_error = NULL, updated_at = ${p(executor, 2)} WHERE id = ${p(executor, 3)}`,
            [nowIso(), nowIso(), job.id]
          );
        } catch (error) {
          await executor.run(
            `UPDATE scheduled_jobs SET attempt = attempt + 1, last_error = ${p(executor, 1)}, updated_at = ${p(executor, 2)} WHERE id = ${p(executor, 3)}`,
            [error instanceof Error ? error.message : String(error), nowIso(), job.id]
          );
        }
        processed += 1;
      }
      return processed;
    },
    async healthCheck() {
      await executor.all("SELECT 1 AS ok");
      return { ok: true };
    }
  };
}

function upsertSql(dialect: DatabaseAdapterExecutor["dialect"]): string {
  const marker = (index: number) => (dialect === "postgresql" ? `$${index}` : "?");
  return `INSERT INTO scheduled_jobs (code, cron_expression, handler_type, payload_json, status, next_run_at, created_at, updated_at)
    VALUES (${marker(1)}, ${marker(2)}, ${marker(3)}, ${marker(4)}, ${marker(5)}, ${marker(6)}, ${marker(7)}, ${marker(8)})
    ON CONFLICT (code) DO UPDATE SET cron_expression = excluded.cron_expression, status = excluded.status, updated_at = excluded.updated_at`;
}

function toScheduledJob(row: DatabaseRow): ScheduledJobRecord {
  return {
    id: String(row.id),
    code: String(row.code),
    cronExpression: String(row.cron_expression),
    enabled: row.status === "enabled",
    handlerType: String(row.handler_type),
    payload: readJson(row.payload_json)
  };
}

function p(executor: DatabaseAdapterExecutor, index: number): string {
  return executor.dialect === "postgresql" ? `$${index}` : "?";
}
