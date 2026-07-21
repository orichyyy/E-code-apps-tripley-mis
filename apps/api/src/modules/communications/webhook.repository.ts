import {
  jsonParam,
  nowIso,
  readJson,
  type DatabaseAdapterExecutor,
  type DatabaseRow,
} from "@web-admin-base/adapters";
import type {
  CreateWebhookSubscriptionRequest,
  ListWebhookDeliveriesQuery,
  UpdateWebhookSubscriptionRequest,
} from "@web-admin-base/contracts";

import type {
  WebhookDeliveryAttemptRecord,
  WebhookDeliveryRecord,
  WebhookSubscriptionRecord,
} from "./communications.types";

type StoredWebhook = Omit<WebhookSubscriptionRecord, "secretConfigured"> & {
  secret: string | null;
};

export class WebhookRepository {
  constructor(private readonly executor: DatabaseAdapterExecutor) {}

  async list(): Promise<WebhookSubscriptionRecord[]> {
    const rows = await this.executor.all(`${subscriptionSelect}
      WHERE is_deleted = ${this.bool(false)} ORDER BY updated_at DESC, id DESC LIMIT 200`);
    return rows.map(toSubscription);
  }

  async create(
    input: CreateWebhookSubscriptionRequest,
    encryptedSecret: string | null,
    actorId: string | null,
  ): Promise<WebhookSubscriptionRecord> {
    const now = nowIso();
    const values = [
      input.name,
      input.url,
      jsonParam(input.eventTypes, this.executor.dialect),
      encryptedSecret,
      input.status,
      now,
      now,
      actorId,
      actorId,
    ];
    const sql = `INSERT INTO webhook_subscriptions
      (name, url, event_types, secret, status, revision, created_at, updated_at, created_by, updated_by)
      VALUES (${this.p(1)}, ${this.p(2)}, ${this.p(3)}, ${this.p(4)}, ${this.p(5)}, 1, ${this.p(6)}, ${this.p(7)}, ${this.p(8)}, ${this.p(9)})`;
    const id = await this.insertId(sql, values);
    return this.requireSubscription(id);
  }

  async update(
    id: string,
    input: UpdateWebhookSubscriptionRequest,
    encryptedSecret: string | null | undefined,
    actorId: string | null,
  ): Promise<WebhookSubscriptionRecord | null> {
    const current = await this.getStored(id);
    if (!current) return null;
    const nextSecret = encryptedSecret === undefined ? current.secret : encryptedSecret;
    const affectsDelivery =
      input.url !== undefined ||
      input.eventTypes !== undefined ||
      input.status !== undefined ||
      encryptedSecret !== undefined;
    const next = { ...current, ...input, secret: nextSecret };
    const revision = current.revision + (affectsDelivery ? 1 : 0);
    const now = nowIso();
    await this.executor.transaction(async () => {
      await this.executor.run(
        `UPDATE webhook_subscriptions SET name = ${this.p(1)}, url = ${this.p(2)},
         event_types = ${this.p(3)}, secret = ${this.p(4)}, status = ${this.p(5)},
         revision = ${this.p(6)}, updated_at = ${this.p(7)}, updated_by = ${this.p(8)}
         WHERE id = ${this.p(9)} AND is_deleted = ${this.bool(false)}`,
        [
          next.name,
          next.url,
          jsonParam(next.eventTypes, this.executor.dialect),
          next.secret,
          next.status,
          revision,
          now,
          actorId,
          id,
        ],
      );
      if (affectsDelivery) await this.cancelPending(id, now, "SUBSCRIPTION_REVISION_CHANGED");
    });
    return this.requireSubscription(id);
  }

  async delete(id: string, actorId: string | null): Promise<WebhookSubscriptionRecord | null> {
    const current = await this.getStored(id);
    if (!current) return null;
    const now = nowIso();
    await this.executor.transaction(async () => {
      await this.executor.run(
        `UPDATE webhook_subscriptions SET status = 'disabled', revision = revision + 1,
         is_deleted = ${this.bool(true)}, deleted_at = ${this.p(1)}, deleted_by = ${this.p(2)},
         updated_at = ${this.p(3)}, updated_by = ${this.p(4)} WHERE id = ${this.p(5)}`,
        [now, actorId, now, actorId, id],
      );
      await this.cancelPending(id, now, "SUBSCRIPTION_DELETED");
    });
    return {
      ...toSubscription({
        ...storedToRow(current),
        status: "disabled",
        is_deleted: true,
        deleted_at: now,
        deleted_by: actorId,
        updated_at: now,
        revision: current.revision + 1,
      }),
    };
  }

  async listDeliveries(query: ListWebhookDeliveriesQuery) {
    const filters: string[] = [];
    const params: unknown[] = [];
    const add = (column: string, value: unknown, operator = "=") => {
      params.push(value);
      filters.push(`${column} ${operator} ${this.p(params.length)}`);
    };
    if (query.subscriptionId) add("subscription_id", query.subscriptionId);
    if (query.eventType) add("event_type", query.eventType);
    if (query.status) add("status", query.status);
    if (query.from) add("created_at", query.from, ">=");
    if (query.to) add("created_at", query.to, "<=");
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const countRows = await this.executor.all(
      `SELECT COUNT(*) AS count FROM webhook_deliveries ${where}`,
      params,
    );
    params.push(query.pageSize, (query.page - 1) * query.pageSize);
    const rows = await this.executor.all(
      `SELECT * FROM webhook_deliveries ${where} ORDER BY created_at DESC, id DESC
       LIMIT ${this.p(params.length - 1)} OFFSET ${this.p(params.length)}`,
      params,
    );
    return {
      items: rows.map(toDelivery),
      page: query.page,
      pageSize: query.pageSize,
      total: Number(countRows[0]?.count ?? 0),
    };
  }

  async getDelivery(id: string) {
    const rows = await this.executor.all(
      `SELECT * FROM webhook_deliveries WHERE id = ${this.p(1)} LIMIT 1`,
      [id],
    );
    if (!rows[0]) return null;
    const attempts = await this.executor.all(
      `SELECT * FROM webhook_delivery_attempts WHERE delivery_id = ${this.p(1)} ORDER BY attempt_number`,
      [id],
    );
    return { ...toDelivery(rows[0]), attempts: attempts.map(toAttempt) };
  }

  private async getStored(id: string): Promise<StoredWebhook | null> {
    const rows = await this.executor.all(
      `${subscriptionSelect}
      WHERE id = ${this.p(1)} AND is_deleted = ${this.bool(false)} LIMIT 1`,
      [id],
    );
    return rows[0] ? toStoredSubscription(rows[0]) : null;
  }

  private async requireSubscription(id: string): Promise<WebhookSubscriptionRecord> {
    const stored = await this.getStored(id);
    if (!stored) throw new Error("Webhook subscription was not persisted.");
    return stripStoredSecret(stored);
  }

  private cancelPending(id: string, now: string, reason: string): Promise<void> {
    return this.executor.run(
      `UPDATE webhook_deliveries SET status = 'canceled', canceled_at = ${this.p(1)},
       last_error_code = ${this.p(2)}, locked_by = NULL, locked_at = NULL, updated_at = ${this.p(3)}
       WHERE subscription_id = ${this.p(4)} AND status = 'pending'`,
      [now, reason, now, id],
    );
  }

  private async insertId(sql: string, params: unknown[]): Promise<string> {
    if (this.executor.dialect === "postgresql") {
      const rows = await this.executor.all(`${sql} RETURNING id`, params);
      return String(rows[0]?.id);
    }
    await this.executor.run(sql, params);
    return String((await this.executor.all("SELECT last_insert_rowid() AS id"))[0]?.id);
  }

  private p(index: number): string {
    return this.executor.dialect === "postgresql" ? `$${index}` : "?";
  }
  private bool(value: boolean): string {
    return this.executor.dialect === "postgresql" ? String(value).toUpperCase() : value ? "1" : "0";
  }
}

const subscriptionSelect = `SELECT id, tenant_id, name, url, event_types, secret, revision, status,
  is_deleted, deleted_at, deleted_by, created_at, updated_at, created_by, updated_by
  FROM webhook_subscriptions`;

function toStoredSubscription(row: DatabaseRow): StoredWebhook {
  return {
    ...toSubscription(row),
    secret: row.secret === null || row.secret === undefined ? null : String(row.secret),
  };
}

function toSubscription(row: DatabaseRow): WebhookSubscriptionRecord {
  return {
    id: String(row.id),
    tenantId: nullableId(row.tenant_id),
    name: String(row.name),
    url: String(row.url),
    eventTypes: readJson<string[]>(row.event_types),
    secretConfigured: Boolean(row.secret),
    revision: Number(row.revision ?? 1),
    status: String(row.status) as WebhookSubscriptionRecord["status"],
    isDeleted: Boolean(row.is_deleted),
    deletedAt: nullableIso(row.deleted_at),
    deletedBy: nullableId(row.deleted_by),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    createdBy: nullableId(row.created_by),
    updatedBy: nullableId(row.updated_by),
  };
}

function stripStoredSecret(record: StoredWebhook): WebhookSubscriptionRecord {
  return {
    id: record.id,
    tenantId: record.tenantId,
    name: record.name,
    url: record.url,
    eventTypes: record.eventTypes,
    secretConfigured: Boolean(record.secret),
    revision: record.revision,
    status: record.status,
    isDeleted: record.isDeleted,
    deletedAt: record.deletedAt,
    deletedBy: record.deletedBy,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    createdBy: record.createdBy,
    updatedBy: record.updatedBy,
  };
}

function storedToRow(record: StoredWebhook): DatabaseRow {
  return {
    id: record.id,
    tenant_id: record.tenantId,
    name: record.name,
    url: record.url,
    event_types: record.eventTypes,
    secret: record.secret,
    status: record.status,
    revision: record.revision,
    is_deleted: record.isDeleted,
    deleted_at: record.deletedAt,
    deleted_by: record.deletedBy,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    created_by: record.createdBy,
    updated_by: record.updatedBy,
  };
}

function toDelivery(row: DatabaseRow): WebhookDeliveryRecord {
  return {
    id: String(row.id),
    eventId: String(row.event_outbox_id),
    subscriptionId: String(row.subscription_id),
    subscriptionRevision: Number(row.subscription_revision),
    eventType: String(row.event_type),
    eventSource: String(row.event_source),
    targetHost: safeHostname(String(row.target_url)),
    status: String(row.status) as WebhookDeliveryRecord["status"],
    attempt: Number(row.attempt),
    maxAttempts: Number(row.max_attempts),
    nextAttemptAt: iso(row.next_attempt_at),
    lastHttpStatus: nullableNumber(row.last_http_status),
    lastErrorCode: nullableString(row.last_error_code),
    lastErrorMessage: nullableString(row.last_error_message),
    succeededAt: nullableIso(row.succeeded_at),
    failedAt: nullableIso(row.failed_at),
    canceledAt: nullableIso(row.canceled_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function toAttempt(row: DatabaseRow): WebhookDeliveryAttemptRecord {
  return {
    id: String(row.id),
    attemptNumber: Number(row.attempt_number),
    status: String(row.status) as WebhookDeliveryAttemptRecord["status"],
    startedAt: iso(row.started_at),
    finishedAt: iso(row.finished_at),
    durationMs: Number(row.duration_ms),
    httpStatus: nullableNumber(row.http_status),
    errorCode: nullableString(row.error_code),
    errorMessage: nullableString(row.error_message),
  };
}

function safeHostname(value: string): string {
  try {
    return new URL(value).hostname;
  } catch {
    return "invalid";
  }
}
function iso(value: unknown): string {
  return new Date(String(value)).toISOString();
}
function nullableIso(value: unknown): string | null {
  return value == null ? null : iso(value);
}
function nullableString(value: unknown): string | null {
  return value == null ? null : String(value);
}
function nullableId(value: unknown): string | null {
  return nullableString(value);
}
function nullableNumber(value: unknown): number | null {
  return value == null ? null : Number(value);
}
