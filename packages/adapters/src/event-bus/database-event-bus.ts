import type { DomainEvent, EventBusAdapter } from ".";
import type { DatabaseAdapterExecutor, DatabaseRow } from "../database/executor";
import { jsonParam, nowIso, readJson } from "../database/executor";

export type DatabaseEventBusAdapter = EventBusAdapter & {
  processNext: (eventType?: string) => Promise<boolean>;
};

type Handler = (event: DomainEvent) => Promise<void>;

export function createDatabaseEventBusAdapter(
  executor: DatabaseAdapterExecutor,
): DatabaseEventBusAdapter {
  const subscribers = new Map<string, Handler[]>();

  return {
    async publish(event) {
      const now = nowIso();
      await executor.run(
        `INSERT INTO event_outbox (event_key, event_type, payload_json, status, attempt, max_attempts, occurred_at, created_at, updated_at)
         VALUES (${p(executor, 1)}, ${p(executor, 2)}, ${p(executor, 3)}, 'pending', 0, 1, ${p(executor, 4)}, ${p(executor, 5)}, ${p(executor, 6)})
         ON CONFLICT (event_key) DO NOTHING`,
        [
          event.id,
          event.type,
          jsonParam(event.payload, executor.dialect),
          event.occurredAt,
          now,
          now,
        ],
      );
    },
    async subscribe(eventType, handler) {
      subscribers.set(eventType, [...(subscribers.get(eventType) ?? []), handler as Handler]);
    },
    async processNext(eventType) {
      const event = await claimNextEvent(executor, eventType);
      if (!event) return false;
      const handlers = subscribers.get(event.type) ?? [];
      try {
        for (const handler of handlers) await handler(event);
        await executor.run(
          `UPDATE event_outbox SET status = 'published', processed_at = ${p(executor, 1)}, updated_at = ${p(executor, 2)} WHERE id = ${p(executor, 3)}`,
          [nowIso(), nowIso(), event.id],
        );
      } catch (error) {
        await executor.run(
          `UPDATE event_outbox SET status = 'failed', last_error = ${p(executor, 1)}, updated_at = ${p(executor, 2)} WHERE id = ${p(executor, 3)}`,
          [error instanceof Error ? error.message : String(error), nowIso(), event.id],
        );
      }
      return true;
    },
    async healthCheck() {
      await executor.all("SELECT 1 AS ok");
      return { ok: true };
    },
  };
}

async function claimNextEvent(
  executor: DatabaseAdapterExecutor,
  eventType?: string,
): Promise<DomainEvent | null> {
  const now = nowIso();
  const rows = await executor.all(
    `SELECT id, event_type, payload_json, occurred_at FROM event_outbox
     WHERE status = 'pending' AND (next_run_at IS NULL OR next_run_at <= ${p(executor, 1)})
     ${eventType ? `AND event_type = ${p(executor, 2)}` : ""}
     ORDER BY id ASC LIMIT 1`,
    eventType ? [now, eventType] : [now],
  );
  return rows[0] ? toEvent(rows[0]) : null;
}

function toEvent(row: DatabaseRow): DomainEvent {
  return {
    id: String(row.id),
    type: String(row.event_type),
    payload: readJson(row.payload_json),
    occurredAt: new Date(String(row.occurred_at)).toISOString(),
  };
}

function p(executor: DatabaseAdapterExecutor, index: number): string {
  return executor.dialect === "postgresql" ? `$${index}` : "?";
}
