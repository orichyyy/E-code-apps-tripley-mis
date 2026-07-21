import {
  nowIso,
  readJson,
  type DatabaseAdapterExecutor,
  type DatabaseRow,
} from "@web-admin-base/adapters";
import type {
  EmailDeliveryAttempt,
  EmailDeliveryDetail,
  EmailDeliveryListQuery,
  EmailDeliverySummary,
} from "@web-admin-base/contracts";

export type EmailRecipientSnapshot = {
  userId: string;
  email: string;
  locale: string;
};

export type EmailTemplateSnapshot = {
  id: string;
  code: string;
  locale: string;
  subject: string | null;
  body: string;
  variables: string[];
  updatedAt: string;
};

export type NewEmailDeliveryRecord = {
  requestKey: string;
  requestFingerprint: string;
  userId: string;
  template: EmailTemplateSnapshot;
  maskedRecipient: string;
  messageId: string;
  contentKeyId: string;
  contentEnvelope: string;
  referenceType: string | null;
  referenceId: string | null;
  maxAttempts: number;
};

export class EmailDeliveryRepository {
  constructor(readonly executor: DatabaseAdapterExecutor) {}

  async findByRequestKey(requestKey: string, userId: string) {
    const rows = await this.executor.all(
      `SELECT * FROM email_deliveries WHERE request_key = ${this.p(1)} AND user_id = ${this.p(2)} LIMIT 1`,
      [requestKey, userId],
    );
    return rows[0] ? toStoredDelivery(rows[0]) : null;
  }

  async resolveEligibleRecipient(userId: string): Promise<EmailRecipientSnapshot | null> {
    const now = nowIso();
    const rows = await this.executor.all(
      `SELECT u.id, u.email, COALESCE(p.language, 'en') AS locale
       FROM users u LEFT JOIN user_preferences p ON p.user_id = u.id
       WHERE u.id = ${this.p(1)} AND u.status = 'enabled'
         AND u.is_deleted = ${this.bool(false)}
         AND (u.locked_until IS NULL OR u.locked_until <= ${this.t(2)}) LIMIT 1`,
      [userId, now],
    );
    const row = rows[0];
    return row
      ? { userId: String(row.id), email: String(row.email), locale: String(row.locale) }
      : null;
  }

  async findEnabledEmailTemplate(
    code: string,
    locale: string,
  ): Promise<EmailTemplateSnapshot | null> {
    const rows = await this.executor.all(
      `SELECT id, code, locale, subject, body, variables_json, updated_at
       FROM notification_templates WHERE channel = 'email' AND code = ${this.p(1)}
         AND locale = ${this.p(2)} AND status = 'enabled' LIMIT 1`,
      [code, locale],
    );
    const row = rows[0];
    return row
      ? {
          id: String(row.id),
          code: String(row.code),
          locale: String(row.locale),
          subject: nullableString(row.subject),
          body: String(row.body),
          variables: readJson<string[]>(row.variables_json),
          updatedAt: iso(row.updated_at),
        }
      : null;
  }

  async create(input: NewEmailDeliveryRecord) {
    const now = nowIso();
    await this.executor.run(
      `INSERT INTO email_deliveries
       (request_key, request_fingerprint, user_id, template_id, template_code, locale,
        template_updated_at, masked_recipient, message_id, content_key_id, content_envelope,
        reference_type, reference_id, status, attempt, max_attempts, next_attempt_at,
        created_at, updated_at)
       VALUES (${this.p(1)}, ${this.p(2)}, ${this.p(3)}, ${this.p(4)}, ${this.p(5)},
        ${this.p(6)}, ${this.t(7)}, ${this.p(8)}, ${this.p(9)}, ${this.p(10)}, ${this.p(11)},
        ${this.p(12)}, ${this.p(13)}, 'pending', 0, ${this.p(14)}, ${this.t(15)},
        ${this.t(16)}, ${this.t(17)})
       ON CONFLICT (request_key, user_id) DO NOTHING`,
      [
        input.requestKey,
        input.requestFingerprint,
        input.userId,
        input.template.id,
        input.template.code,
        input.template.locale,
        input.template.updatedAt,
        input.maskedRecipient,
        input.messageId,
        input.contentKeyId,
        input.contentEnvelope,
        input.referenceType,
        input.referenceId,
        input.maxAttempts,
        now,
        now,
        now,
      ],
    );
    return this.findByRequestKey(input.requestKey, input.userId);
  }

  async list(query: EmailDeliveryListQuery): Promise<{
    items: EmailDeliverySummary[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const filters = this.buildFilters(query);
    const rows = await this.executor.all(
      `SELECT * FROM email_deliveries${filters.sql}
       ORDER BY created_at DESC, id DESC LIMIT ${Math.floor(query.pageSize)}
       OFFSET ${Math.floor((query.page - 1) * query.pageSize)}`,
      filters.params,
    );
    const totals = await this.executor.all(
      `SELECT COUNT(*) AS total FROM email_deliveries${filters.sql}`,
      filters.params,
    );
    return {
      items: rows.map(toEmailDeliverySummary),
      total: Number(totals[0]?.total ?? 0),
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(id: string): Promise<EmailDeliveryDetail | null> {
    const rows = await this.executor.all(
      `SELECT * FROM email_deliveries WHERE id = ${this.p(1)} LIMIT 1`,
      [id],
    );
    if (!rows[0]) return null;
    const attempts = await this.executor.all(
      `SELECT * FROM email_delivery_attempts WHERE delivery_id = ${this.p(1)}
       ORDER BY attempt_number ASC`,
      [id],
    );
    return {
      ...toEmailDeliverySummary(rows[0]),
      referenceType: nullableString(rows[0].reference_type),
      referenceId: nullableString(rows[0].reference_id),
      lastSmtpCode: nullableNumber(rows[0].last_smtp_code),
      lastErrorCode: nullableString(rows[0].last_error_code),
      lastErrorMessage: nullableString(rows[0].last_error_message),
      attempts: attempts.map(toEmailDeliveryAttempt),
    };
  }

  async countActiveByKeyId(keyId: string): Promise<number> {
    const rows = await this.executor.all(
      `SELECT COUNT(*) AS total FROM email_deliveries
       WHERE status IN ('pending', 'running') AND content_key_id = ${this.p(1)}`,
      [keyId],
    );
    return Number(rows[0]?.total ?? 0);
  }

  private buildFilters(query: EmailDeliveryListQuery) {
    const clauses: string[] = [];
    const params: unknown[] = [];
    const add = (sql: (index: number) => string, value: unknown) => {
      params.push(value);
      clauses.push(sql(params.length));
    };
    if (query.userId) add((index) => `user_id = ${this.p(index)}`, query.userId);
    if (query.templateCode) add((index) => `template_code = ${this.p(index)}`, query.templateCode);
    if (query.locale) add((index) => `locale = ${this.p(index)}`, query.locale);
    if (query.status) add((index) => `status = ${this.p(index)}`, query.status);
    if (query.from) add((index) => `created_at >= ${this.t(index)}`, query.from);
    if (query.to) add((index) => `created_at <= ${this.t(index)}`, query.to);
    return { sql: clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : "", params };
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

function toStoredDelivery(row: DatabaseRow) {
  return {
    ...toEmailDeliverySummary(row),
    requestFingerprint: String(row.request_fingerprint),
  };
}

function toEmailDeliverySummary(row: DatabaseRow): EmailDeliverySummary {
  return {
    id: String(row.id),
    requestKey: String(row.request_key),
    userId: String(row.user_id),
    templateId: String(row.template_id),
    templateCode: String(row.template_code),
    locale: String(row.locale),
    maskedRecipient: String(row.masked_recipient),
    status: String(row.status) as EmailDeliverySummary["status"],
    attempt: Number(row.attempt),
    maxAttempts: Number(row.max_attempts),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    succeededAt: nullableIso(row.succeeded_at),
    failedAt: nullableIso(row.failed_at),
    canceledAt: nullableIso(row.canceled_at),
    contentPurgedAt: nullableIso(row.content_purged_at),
  };
}

function toEmailDeliveryAttempt(row: DatabaseRow): EmailDeliveryAttempt {
  return {
    id: String(row.id),
    deliveryId: String(row.delivery_id),
    attemptNumber: Number(row.attempt_number),
    status: String(row.status) as EmailDeliveryAttempt["status"],
    startedAt: iso(row.started_at),
    finishedAt: iso(row.finished_at),
    durationMs: Number(row.duration_ms),
    smtpCode: nullableNumber(row.smtp_code),
    errorCode: nullableString(row.error_code),
    errorMessage: nullableString(row.error_message),
    createdAt: iso(row.created_at),
  };
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

function nullableNumber(value: unknown): number | null {
  return value == null ? null : Number(value);
}
