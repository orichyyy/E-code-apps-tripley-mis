import { randomUUID } from "node:crypto";

import type { QueueAdapter, QueueJob } from ".";
import type { DatabaseAdapterExecutor, DatabaseRow } from "../database/executor";
import { jsonParam, nowIso, readJson } from "../database/executor";

export type DatabaseQueueAdapter = QueueAdapter & {
  processNext: (type?: string) => Promise<boolean>;
  processReady: (limit?: number) => Promise<number>;
  recoverStaleRunningJobs: () => Promise<void>;
};

type Handler = (job: QueueJob) => Promise<void>;

export type DatabaseQueueAdapterOptions = {
  workerId?: string;
  retryDelaySeconds?: number;
  maxAttempts?: number;
  runningTimeoutSeconds?: number;
};

export function createDatabaseQueueAdapter(
  executor: DatabaseAdapterExecutor,
  options: DatabaseQueueAdapterOptions = {},
): DatabaseQueueAdapter {
  const handlers = new Map<string, Handler>();
  const workerId = options.workerId ?? randomUUID();
  const retryDelaySeconds = options.retryDelaySeconds ?? 60;
  const maxAttempts = options.maxAttempts ?? 3;
  const runningTimeoutSeconds = options.runningTimeoutSeconds ?? 15 * 60;

  return {
    async enqueue<TPayload>(type: string, payload: TPayload) {
      const now = nowIso();
      await executor.run(
        `INSERT INTO queue_jobs (type, payload_json, status, attempt, max_attempts, available_at, created_at, updated_at)
         VALUES (${p(executor, 1)}, ${p(executor, 2)}, 'pending', 0, ${p(executor, 3)}, ${timestampP(executor, 4)}, ${timestampP(executor, 5)}, ${timestampP(executor, 6)})`,
        [type, jsonParam(payload, executor.dialect), maxAttempts, now, now, now],
      );
      const rows = await executor.all(
        `SELECT id, type, payload_json FROM queue_jobs WHERE type = ${p(executor, 1)} ORDER BY id DESC LIMIT 1`,
        [type],
      );
      return toQueueJob<TPayload>(rows[0]);
    },
    async consume(type, handler) {
      handlers.set(type, handler as Handler);
    },
    async processNext(type) {
      await recoverStaleRunningJobs(executor, runningTimeoutSeconds);
      const job = await claimNextJob(executor, workerId, type);
      if (!job) return false;
      const handler = handlers.get(job.type);
      if (!handler) {
        await failJob(executor, job.id, "No handler registered", retryDelaySeconds);
        return true;
      }
      try {
        await handler(job);
        await completeJob(executor, job.id);
      } catch (error) {
        await failJob(
          executor,
          job.id,
          error instanceof Error ? error.message : String(error),
          retryDelaySeconds,
        );
      }
      return true;
    },
    async processReady(limit = 10) {
      await recoverStaleRunningJobs(executor, runningTimeoutSeconds);
      let processed = 0;
      for (let index = 0; index < limit; index += 1) {
        if (!(await this.processNext())) break;
        processed += 1;
      }
      return processed;
    },
    async recoverStaleRunningJobs() {
      await recoverStaleRunningJobs(executor, runningTimeoutSeconds);
    },
    async healthCheck() {
      await executor.all("SELECT 1 AS ok");
      return { ok: true };
    },
  };
}

async function claimNextJob(
  executor: DatabaseAdapterExecutor,
  workerId: string,
  type?: string,
): Promise<QueueJob | null> {
  return executor.transaction(async () => {
    const now = nowIso();
    const rows = await executor.all(
      `SELECT id, type, payload_json FROM queue_jobs
       WHERE status = 'pending' AND available_at <= ${timestampP(executor, 1)}
       AND (next_run_at IS NULL OR next_run_at <= ${timestampP(executor, 2)})
       ${type ? `AND type = ${p(executor, 3)}` : ""}
       ORDER BY id ASC LIMIT 1`,
      type ? [now, now, type] : [now, now],
    );
    if (!rows[0]) return null;
    await executor.run(
      `UPDATE queue_jobs SET status = 'running', attempt = attempt + 1, locked_by = ${p(executor, 1)}, locked_at = ${timestampP(executor, 2)}, updated_at = ${timestampP(executor, 3)}
       WHERE id = ${p(executor, 4)} AND status = 'pending'`,
      [workerId, now, now, rows[0].id],
    );
    return toQueueJob(rows[0]);
  });
}

async function completeJob(executor: DatabaseAdapterExecutor, id: string): Promise<void> {
  const now = nowIso();
  await executor.run(
    `UPDATE queue_jobs SET status = 'succeeded', locked_by = NULL, locked_at = NULL, completed_at = ${timestampP(executor, 1)}, updated_at = ${timestampP(executor, 2)} WHERE id = ${p(executor, 3)}`,
    [now, now, id],
  );
}

async function failJob(
  executor: DatabaseAdapterExecutor,
  id: string,
  error: string,
  retryDelaySeconds: number,
): Promise<void> {
  const rows = await executor.all(
    `SELECT attempt, max_attempts FROM queue_jobs WHERE id = ${p(executor, 1)}`,
    [id],
  );
  const attempt = Number(rows[0]?.attempt ?? 1);
  const maxAttempts = Number(rows[0]?.max_attempts ?? 1);
  const now = nowIso();
  const finalStatus = attempt >= maxAttempts ? "dead_letter" : "pending";
  const nextRunAt =
    finalStatus === "pending"
      ? new Date(Date.now() + retryDelaySeconds * 1000).toISOString()
      : null;
  await executor.run(
    `UPDATE queue_jobs SET status = ${p(executor, 1)}, locked_by = NULL, locked_at = NULL, last_error = ${p(executor, 2)}, next_run_at = ${timestampP(executor, 3)}, updated_at = ${timestampP(executor, 4)} WHERE id = ${p(executor, 5)}`,
    [finalStatus, error, nextRunAt, now, id],
  );
}

async function recoverStaleRunningJobs(
  executor: DatabaseAdapterExecutor,
  runningTimeoutSeconds: number,
): Promise<void> {
  const cutoff = new Date(Date.now() - runningTimeoutSeconds * 1000).toISOString();
  const now = nowIso();
  await executor.run(
    `UPDATE queue_jobs
     SET status = CASE WHEN attempt >= max_attempts THEN 'dead_letter' ELSE 'pending' END,
         locked_by = NULL,
         locked_at = NULL,
         last_error = COALESCE(last_error, ${p(executor, 1)}),
         next_run_at = CASE WHEN attempt >= max_attempts THEN NULL ELSE ${timestampP(executor, 2)} END,
         updated_at = ${timestampP(executor, 3)}
     WHERE status = 'running' AND locked_at IS NOT NULL AND locked_at <= ${timestampP(executor, 4)}`,
    ["Queue job running timeout exceeded", now, now, cutoff],
  );
}

function toQueueJob<TPayload = unknown>(row: DatabaseRow): QueueJob<TPayload> {
  return {
    id: String(row.id),
    type: String(row.type),
    payload: readJson<TPayload>(row.payload_json),
  };
}

function p(executor: DatabaseAdapterExecutor, index: number): string {
  return executor.dialect === "postgresql" ? `$${index}` : "?";
}

function timestampP(executor: DatabaseAdapterExecutor, index: number): string {
  return executor.dialect === "postgresql" ? `$${index}::timestamptz` : "?";
}
