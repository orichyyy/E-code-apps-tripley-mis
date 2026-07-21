import {
  jsonParam,
  nowIso,
  readJson,
  type DatabaseAdapterExecutor,
  type DatabaseRow,
} from "@web-admin-base/adapters";
import { baseWebhookEventTypes, webhookEventTypeSchema } from "@web-admin-base/contracts";
import {
  parseOutboxEvent,
  parsePersistedEvent,
  type DeliverableWebhookEvent,
} from "./webhook-event-parser";

export type ClaimedWebhookDelivery = {
  id: string;
  eventId: string;
  subscriptionId: string;
  eventSource: string;
  event: DeliverableWebhookEvent;
  targetUrl: string;
  encryptedSecret: string | null;
  attempt: number;
  maxAttempts: number;
};

export type WebhookAttemptResult = {
  delivery: ClaimedWebhookDelivery;
  status: "succeeded" | "failed";
  retry: boolean;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  httpStatus: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  nextAttemptAt: string | null;
};

export class WebhookDeliveryRepository {
  private readonly allowedEventTypes: readonly string[];

  constructor(
    private readonly executor: DatabaseAdapterExecutor,
    allowedEventTypes: readonly string[] = baseWebhookEventTypes,
  ) {
    this.allowedEventTypes = [...new Set(allowedEventTypes)].sort();
  }

  async fanOutPending(eventSource: string, maxAttempts: number, limit = 100): Promise<number> {
    if (limit <= 0) return 0;
    return this.executor.transaction(async () => {
      const rows = await this.executor.all(
        `SELECT id, event_type, payload_json, occurred_at FROM event_outbox
         WHERE status = 'pending' AND event_type IN (${this.eventTypePlaceholders()})
         ORDER BY id ASC LIMIT ${Math.floor(limit)}${this.forUpdateSkipLocked()}`,
        [...this.allowedEventTypes],
      );
      for (const row of rows) await this.fanOutEvent(row, eventSource, maxAttempts);
      return rows.length;
    });
  }

  async recoverStaleRunning(timeoutSeconds = 15 * 60): Promise<void> {
    const now = nowIso();
    const cutoff = new Date(Date.now() - timeoutSeconds * 1000).toISOString();
    await this.executor.run(
      `UPDATE webhook_deliveries SET
       status = CASE WHEN attempt >= max_attempts THEN 'failed' ELSE 'pending' END,
       failed_at = CASE WHEN attempt >= max_attempts THEN ${this.t(1)} ELSE NULL END,
       next_attempt_at = CASE WHEN attempt >= max_attempts THEN next_attempt_at ELSE ${this.t(2)} END,
       last_error_code = 'WORKER_TIMEOUT', last_error_message = 'Delivery worker timed out.',
       locked_by = NULL, locked_at = NULL, updated_at = ${this.t(3)}
       WHERE status = 'running' AND locked_at <= ${this.t(4)}`,
      [now, now, now, cutoff],
    );
  }

  async claimReady(workerId: string, limit: number): Promise<ClaimedWebhookDelivery[]> {
    return this.executor.transaction(async () => {
      const now = nowIso();
      const rows = await this.executor.all(
        `SELECT d.*, s.secret, s.revision AS current_revision, s.status AS subscription_status,
                s.is_deleted AS subscription_deleted
         FROM webhook_deliveries d JOIN webhook_subscriptions s ON s.id = d.subscription_id
         WHERE d.status = 'pending' AND d.next_attempt_at <= ${this.t(1)}
           AND NOT EXISTS (SELECT 1 FROM webhook_deliveries active
             WHERE active.subscription_id = d.subscription_id AND active.status = 'running')
         ORDER BY d.next_attempt_at ASC, d.id ASC LIMIT ${Math.max(1, Math.floor(limit * 4))}
         ${this.forUpdateSkipLocked()}`,
        [now],
      );
      const selected: DatabaseRow[] = [];
      const subscriptions = new Set<string>();
      for (const row of rows) {
        const subscriptionId = String(row.subscription_id);
        if (subscriptions.has(subscriptionId)) continue;
        if (this.isStaleSubscription(row)) {
          await this.cancel(String(row.id), now, "SUBSCRIPTION_REVISION_CHANGED");
          continue;
        }
        subscriptions.add(subscriptionId);
        selected.push(row);
        if (selected.length >= limit) break;
      }
      for (const row of selected) {
        await this.executor.run(
          `UPDATE webhook_deliveries SET status = 'running', attempt = attempt + 1,
           locked_by = ${this.p(1)}, locked_at = ${this.t(2)}, updated_at = ${this.t(3)}
           WHERE id = ${this.p(4)} AND status = 'pending'`,
          [workerId, now, now, row.id],
        );
      }
      return selected.map((row) => toClaimed(row));
    });
  }

  async recordAttempt(result: WebhookAttemptResult): Promise<void> {
    await this.executor.transaction(async () => {
      await this.executor.run(
        `INSERT INTO webhook_delivery_attempts
         (delivery_id, attempt_number, status, started_at, finished_at, duration_ms,
          http_status, error_code, error_message, created_at)
         VALUES (${this.p(1)}, ${this.p(2)}, ${this.p(3)}, ${this.p(4)}, ${this.p(5)},
          ${this.p(6)}, ${this.p(7)}, ${this.p(8)}, ${this.p(9)}, ${this.p(10)})
         ON CONFLICT (delivery_id, attempt_number) DO NOTHING`,
        [
          result.delivery.id,
          result.delivery.attempt,
          result.status,
          result.startedAt,
          result.finishedAt,
          result.durationMs,
          result.httpStatus,
          result.errorCode,
          result.errorMessage,
          result.finishedAt,
        ],
      );
      const terminalFailure = result.status === "failed" && !result.retry;
      const status =
        result.status === "succeeded" ? "succeeded" : result.retry ? "pending" : "failed";
      await this.executor.run(
        `UPDATE webhook_deliveries SET status = ${this.p(1)}, next_attempt_at = ${this.p(2)},
         last_http_status = ${this.p(3)}, last_error_code = ${this.p(4)},
         last_error_message = ${this.p(5)}, succeeded_at = ${this.p(6)}, failed_at = ${this.p(7)},
         locked_by = NULL, locked_at = NULL, updated_at = ${this.p(8)} WHERE id = ${this.p(9)}`,
        [
          status,
          result.nextAttemptAt ?? result.finishedAt,
          result.httpStatus,
          result.errorCode,
          result.errorMessage,
          result.status === "succeeded" ? result.finishedAt : null,
          terminalFailure ? result.finishedAt : null,
          result.finishedAt,
          result.delivery.id,
        ],
      );
    });
  }

  async cleanup(retentionDays: number): Promise<{
    deliveries: number;
    publishedOutbox: number;
    failedOutbox: number;
  }> {
    const cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString();
    const rows = await this.executor.all(
      `SELECT id FROM webhook_deliveries WHERE status IN ('succeeded', 'failed', 'canceled')
       AND updated_at < ${this.t(1)} LIMIT 1000`,
      [cutoff],
    );
    if (rows.length > 0)
      await this.executor.transaction(async () => {
        for (const row of rows) {
          await this.executor.run(
            `DELETE FROM webhook_delivery_attempts WHERE delivery_id = ${this.p(1)}`,
            [row.id],
          );
          await this.executor.run(`DELETE FROM webhook_deliveries WHERE id = ${this.p(1)}`, [
            row.id,
          ]);
        }
      });
    const publishedOutbox = await this.deleteOutboxBefore("published", 7);
    const failedOutbox = await this.deleteOutboxBefore("failed", 90);
    return { deliveries: rows.length, publishedOutbox, failedOutbox };
  }

  private async deleteOutboxBefore(status: "published" | "failed", days: number): Promise<number> {
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
    const rows = await this.executor.all(
      `SELECT id FROM event_outbox WHERE status = ${this.p(1)}
       AND updated_at < ${this.t(2)} ORDER BY id ASC LIMIT 1000`,
      [status, cutoff],
    );
    if (rows.length === 0) return 0;
    await this.executor.transaction(async () => {
      for (const row of rows) {
        await this.executor.run(`DELETE FROM event_outbox WHERE id = ${this.p(1)}`, [row.id]);
      }
    });
    return rows.length;
  }

  private async fanOutEvent(
    row: DatabaseRow,
    eventSource: string,
    maxAttempts: number,
  ): Promise<void> {
    const type = webhookEventTypeSchema.parse(row.event_type);
    const raw = readJson<Record<string, unknown>>(row.payload_json);
    const event = parseOutboxEvent(type, raw, iso(row.occurred_at));
    const subscriptions = await this.matchingSubscriptions(event);
    const now = nowIso();
    for (const subscription of subscriptions) {
      await this.executor.run(
        `INSERT INTO webhook_deliveries
         (event_outbox_id, subscription_id, subscription_revision, event_type, event_source,
          event_payload_json, target_url, status, attempt, max_attempts, next_attempt_at, created_at, updated_at)
         VALUES (${this.p(1)}, ${this.p(2)}, ${this.p(3)}, ${this.p(4)}, ${this.p(5)}, ${this.p(6)},
          ${this.p(7)}, 'pending', 0, ${this.p(8)}, ${this.p(9)}, ${this.p(10)}, ${this.p(11)})
         ON CONFLICT (event_outbox_id, subscription_id) DO NOTHING`,
        [
          row.id,
          subscription.id,
          subscription.revision,
          type,
          eventSource,
          jsonParam(event, this.executor.dialect),
          subscription.url,
          maxAttempts,
          now,
          now,
          now,
        ],
      );
    }
    await this.executor.run(
      `UPDATE event_outbox SET status = 'published', processed_at = ${this.p(1)}, updated_at = ${this.p(2)}
       WHERE id = ${this.p(3)}`,
      [now, now, row.id],
    );
  }

  private async matchingSubscriptions(event: DeliverableWebhookEvent) {
    const params: unknown[] = [];
    let target = "";
    if (event.type === "notification.requested" && "targetSubscriptionId" in event) {
      params.push(event.targetSubscriptionId);
      target = ` AND id = ${this.p(params.length)}`;
    }
    const rows = await this.executor.all(
      `SELECT id, url, revision, event_types FROM webhook_subscriptions
       WHERE status = 'enabled' AND is_deleted = ${this.bool(false)}${target}`,
      params,
    );
    return rows
      .filter((row) => readJson<string[]>(row.event_types).includes(event.type))
      .map((row) => ({ id: String(row.id), url: String(row.url), revision: Number(row.revision) }));
  }

  private isStaleSubscription(row: DatabaseRow): boolean {
    return (
      Boolean(row.subscription_deleted) ||
      row.subscription_status !== "enabled" ||
      Number(row.current_revision) !== Number(row.subscription_revision)
    );
  }

  private cancel(id: string, now: string, reason: string): Promise<void> {
    return this.executor.run(
      `UPDATE webhook_deliveries SET status = 'canceled', canceled_at = ${this.p(1)},
       last_error_code = ${this.p(2)}, locked_by = NULL, locked_at = NULL, updated_at = ${this.p(3)}
       WHERE id = ${this.p(4)} AND status = 'pending'`,
      [now, reason, now, id],
    );
  }

  private eventTypePlaceholders(): string {
    return this.allowedEventTypes.map((_, index) => this.p(index + 1)).join(", ");
  }
  private forUpdateSkipLocked(): string {
    return this.executor.dialect === "postgresql" ? " FOR UPDATE SKIP LOCKED" : "";
  }
  private p(index: number): string {
    return this.executor.dialect === "postgresql" ? `$${index}` : "?";
  }
  private t(index: number): string {
    return this.executor.dialect === "postgresql" ? `$${index}::timestamptz` : "?";
  }
  private bool(value: boolean): string {
    return this.executor.dialect === "postgresql" ? String(value).toUpperCase() : value ? "1" : "0";
  }
}

function toClaimed(row: DatabaseRow): ClaimedWebhookDelivery {
  return {
    id: String(row.id),
    eventId: String(row.event_outbox_id),
    subscriptionId: String(row.subscription_id),
    eventSource: String(row.event_source),
    event: parsePersistedEvent(readJson(row.event_payload_json)),
    targetUrl: String(row.target_url),
    encryptedSecret: row.secret == null ? null : String(row.secret),
    attempt: Number(row.attempt) + 1,
    maxAttempts: Number(row.max_attempts),
  };
}

function iso(value: unknown): string {
  return new Date(String(value)).toISOString();
}
