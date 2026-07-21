import type { JobSchedulerAdapter, ScheduledJobDefinition } from ".";
import type { DatabaseAdapterExecutor, DatabaseRow } from "../database/executor";
import { jsonParam, nowIso, readJson } from "../database/executor";
import { computeNextCronRun } from "./cron";

export type ScheduledJobRecord<TPayload = unknown> = ScheduledJobDefinition & {
  id: string;
  handlerType: string;
  payload: TPayload;
  attempt: number;
  maxAttempts: number;
};

export type DatabaseJobSchedulerAdapter = JobSchedulerAdapter & {
  processDue: (limit?: number) => Promise<number>;
};

type Handler = (job: ScheduledJobRecord) => Promise<void>;

export type DatabaseJobSchedulerAdapterOptions = {
  retryDelaySeconds?: number;
  runningTimeoutSeconds?: number;
  executionLogs?: boolean;
  emitJobFailureEvents?: boolean;
};

export function createDatabaseJobSchedulerAdapter(
  executor: DatabaseAdapterExecutor,
  options: DatabaseJobSchedulerAdapterOptions = {},
): DatabaseJobSchedulerAdapter {
  const handlers = new Map<string, Handler>();
  const retryDelaySeconds = options.retryDelaySeconds ?? 60;
  const runningTimeoutSeconds = options.runningTimeoutSeconds ?? 15 * 60;
  const executionLogs = options.executionLogs ?? true;
  const emitJobFailureEvents = options.emitJobFailureEvents ?? false;

  return {
    async register(job, handler) {
      handlers.set(job.code, handler as Handler);
      const now = nowIso();
      const nextRunAt = computeNextCronRun(job.cronExpression, new Date(now));
      await executor.run(upsertSql(executor.dialect), [
        job.code,
        job.cronExpression,
        job.code,
        jsonParam({}, executor.dialect),
        job.enabled ? "enabled" : "disabled",
        nextRunAt,
        now,
        now,
      ]);
    },
    async unregister(jobCode) {
      handlers.delete(jobCode);
      await executor.run(
        `UPDATE scheduled_jobs SET status = 'disabled', updated_at = ${p(executor, 1)} WHERE code = ${p(executor, 2)}`,
        [nowIso(), jobCode],
      );
    },
    async processDue(limit = 10) {
      let processed = 0;
      for (let index = 0; index < limit; index += 1) {
        const job = await claimNextDueJob(executor, runningTimeoutSeconds);
        if (!job) break;
        const handler = handlers.get(job.handlerType) ?? handlers.get(job.code);
        const startedAt = new Date();
        if (!handler) {
          await markScheduleFailure(
            executor,
            job,
            "No handler registered",
            retryDelaySeconds,
            executionLogs,
            startedAt,
            emitJobFailureEvents,
          );
          processed += 1;
          continue;
        }
        try {
          await handler(job);
          await markScheduleSuccess(executor, job, executionLogs, startedAt);
        } catch (error) {
          await markScheduleFailure(
            executor,
            job,
            error instanceof Error ? error.message : String(error),
            retryDelaySeconds,
            executionLogs,
            startedAt,
            emitJobFailureEvents,
          );
        }
        processed += 1;
      }
      return processed;
    },
    async healthCheck() {
      await executor.all("SELECT 1 AS ok");
      return { ok: true };
    },
  };
}

function upsertSql(dialect: DatabaseAdapterExecutor["dialect"]): string {
  const marker = (index: number) => (dialect === "postgresql" ? `$${index}` : "?");
  return `INSERT INTO scheduled_jobs (code, cron_expression, handler_type, payload_json, status, next_run_at, created_at, updated_at)
    VALUES (${marker(1)}, ${marker(2)}, ${marker(3)}, ${marker(4)}, ${marker(5)}, ${marker(6)}, ${marker(7)}, ${marker(8)})
    ON CONFLICT (code) DO UPDATE SET
      cron_expression = excluded.cron_expression,
      status = excluded.status,
      next_run_at = COALESCE(scheduled_jobs.next_run_at, excluded.next_run_at),
      updated_at = excluded.updated_at`;
}

function toScheduledJob(row: DatabaseRow): ScheduledJobRecord {
  return {
    id: String(row.id),
    code: String(row.code),
    cronExpression: String(row.cron_expression),
    enabled: row.status === "enabled",
    handlerType: String(row.handler_type),
    payload: readJson(row.payload_json),
    attempt: Number(row.attempt ?? 0),
    maxAttempts: Number(row.max_attempts ?? 1),
  };
}

async function claimNextDueJob(
  executor: DatabaseAdapterExecutor,
  runningTimeoutSeconds: number,
): Promise<ScheduledJobRecord | null> {
  return executor.transaction(async () => {
    const now = nowIso();
    const rows = await executor.all(
      `SELECT id, code, cron_expression, handler_type, payload_json, status, attempt, max_attempts
       FROM scheduled_jobs
       WHERE status = 'enabled' AND (next_run_at IS NULL OR next_run_at <= ${p(executor, 1)})
       ORDER BY id ASC LIMIT 1`,
      [now],
    );
    if (!rows[0]) return null;
    const lockUntil = new Date(Date.now() + runningTimeoutSeconds * 1000).toISOString();
    await executor.run(
      `UPDATE scheduled_jobs SET attempt = attempt + 1, next_run_at = ${p(executor, 1)}, updated_at = ${p(executor, 2)}
       WHERE id = ${p(executor, 3)} AND status = 'enabled'`,
      [lockUntil, now, rows[0].id],
    );
    return toScheduledJob({ ...rows[0], attempt: Number(rows[0].attempt ?? 0) + 1 });
  });
}

async function markScheduleSuccess(
  executor: DatabaseAdapterExecutor,
  job: ScheduledJobRecord,
  executionLogs: boolean,
  startedAt: Date,
): Promise<void> {
  const now = nowIso();
  await executor.run(
    `UPDATE scheduled_jobs
     SET last_run_at = ${p(executor, 1)}, next_run_at = ${p(executor, 2)}, attempt = 0, last_error = NULL, updated_at = ${p(executor, 3)}
     WHERE id = ${p(executor, 4)}`,
    [now, computeNextCronRun(job.cronExpression, new Date(now)), now, job.id],
  );
  if (executionLogs) {
    await writeSchedulerLog(executor, job, "info", "Scheduled job succeeded", startedAt, now);
  }
}

async function markScheduleFailure(
  executor: DatabaseAdapterExecutor,
  job: ScheduledJobRecord,
  error: string,
  retryDelaySeconds: number,
  executionLogs: boolean,
  startedAt: Date,
  emitJobFailureEvents: boolean,
): Promise<void> {
  const now = nowIso();
  const exhausted = job.attempt >= job.maxAttempts;
  const nextRunAt = exhausted
    ? computeNextCronRun(job.cronExpression, new Date(now))
    : new Date(Date.now() + retryDelaySeconds * 1000).toISOString();
  await executor.transaction(async () => {
    await executor.run(
      `UPDATE scheduled_jobs
       SET next_run_at = ${p(executor, 1)}, attempt = ${p(executor, 2)}, last_error = ${p(executor, 3)}, updated_at = ${p(executor, 4)}
       WHERE id = ${p(executor, 5)}`,
      [nextRunAt, exhausted ? 0 : job.attempt, error, now, job.id],
    );
    if (executionLogs) await writeSchedulerLog(executor, job, "error", error, startedAt, now);
    if (exhausted && emitJobFailureEvents && !job.code.startsWith("webhook.")) {
      const event = {
        subject: `jobs/scheduled/${job.id}`,
        occurredAt: now,
        data: {
          jobId: job.id,
          jobKind: "scheduled",
          jobCode: job.code,
          attempt: job.attempt,
          maxAttempts: job.maxAttempts,
        },
      };
      await executor.run(
        `INSERT INTO event_outbox (event_type, payload_json, status, attempt, max_attempts, occurred_at, created_at, updated_at)
         VALUES ('job.failed', ${p(executor, 1)}, 'pending', 0, 1, ${p(executor, 2)}, ${p(executor, 3)}, ${p(executor, 4)})`,
        [jsonParam(event, executor.dialect), now, now, now],
      );
    }
  });
}

async function writeSchedulerLog(
  executor: DatabaseAdapterExecutor,
  job: ScheduledJobRecord,
  level: "info" | "error",
  message: string,
  startedAt: Date,
  finishedAt: string,
): Promise<void> {
  await executor.run(
    `INSERT INTO log_entries (log_type, level, message, metadata_json, occurred_at, created_at)
     VALUES ('scheduler', ${p(executor, 1)}, ${p(executor, 2)}, ${p(executor, 3)}, ${p(executor, 4)}, ${p(executor, 5)})`,
    [
      level,
      message,
      jsonParam(
        {
          scheduledJobId: job.id,
          code: job.code,
          handlerType: job.handlerType,
          attempt: job.attempt,
          maxAttempts: job.maxAttempts,
          durationMs: Math.max(0, new Date(finishedAt).getTime() - startedAt.getTime()),
        },
        executor.dialect,
      ),
      finishedAt,
      finishedAt,
    ],
  );
}

function p(executor: DatabaseAdapterExecutor, index: number): string {
  return executor.dialect === "postgresql" ? `$${index}` : "?";
}
