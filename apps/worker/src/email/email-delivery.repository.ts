import { nowIso, type DatabaseAdapterExecutor, type DatabaseRow } from "@web-admin-base/adapters";

export type ClaimedEmailDelivery = {
  id: string;
  userId: string;
  templateCode: string;
  locale: string;
  maskedRecipient: string;
  messageId: string;
  contentKeyId: string;
  contentEnvelope: string;
  attempt: number;
  maxAttempts: number;
};

export type EmailAttemptResult = {
  delivery: ClaimedEmailDelivery;
  status: "succeeded" | "failed";
  retry: boolean;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  smtpCode: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  nextAttemptAt: string | null;
};

export class WorkerEmailDeliveryRepository {
  constructor(private readonly executor: DatabaseAdapterExecutor) {}

  async recoverStaleRunning(timeoutSeconds: number): Promise<
    Array<{
      id: string;
      userId: string;
      templateCode: string;
      locale: string;
      maskedRecipient: string;
      attempt: number;
    }>
  > {
    const now = nowIso();
    const cutoff = new Date(Date.now() - timeoutSeconds * 1000).toISOString();
    const recovered = await this.executor.all(
      `UPDATE email_deliveries SET
       status = CASE WHEN attempt >= max_attempts THEN 'failed' ELSE 'pending' END,
       failed_at = CASE WHEN attempt >= max_attempts THEN ${this.t(1)} ELSE NULL END,
       next_attempt_at = CASE WHEN attempt >= max_attempts THEN next_attempt_at ELSE ${this.t(2)} END,
       content_envelope = CASE WHEN attempt >= max_attempts THEN NULL ELSE content_envelope END,
       content_key_id = CASE WHEN attempt >= max_attempts THEN NULL ELSE content_key_id END,
       content_purged_at = CASE WHEN attempt >= max_attempts THEN ${this.t(3)} ELSE NULL END,
       last_error_code = 'WORKER_TIMEOUT', last_error_message = 'Delivery worker timed out.',
       locked_by = NULL, locked_at = NULL, updated_at = ${this.t(4)}
       WHERE status = 'running' AND locked_at <= ${this.t(5)}
       RETURNING id, user_id, template_code, locale, masked_recipient, attempt, status`,
      [now, now, now, now, cutoff],
    );
    return recovered
      .filter((row) => row.status === "failed")
      .map((row) => ({
        id: String(row.id),
        userId: String(row.user_id),
        templateCode: String(row.template_code),
        locale: String(row.locale),
        maskedRecipient: String(row.masked_recipient),
        attempt: Number(row.attempt),
      }));
  }

  async cancelDeletedUsers(): Promise<void> {
    const now = nowIso();
    await this.executor.run(
      `UPDATE email_deliveries SET status = 'canceled', canceled_at = ${this.t(1)},
       content_envelope = NULL, content_key_id = NULL, content_purged_at = ${this.t(2)},
       last_error_code = 'USER_DELETED', last_error_message = 'Recipient user was deleted.',
       locked_by = NULL, locked_at = NULL, updated_at = ${this.t(3)}
       WHERE status = 'pending' AND EXISTS (
         SELECT 1 FROM users WHERE users.id = email_deliveries.user_id
           AND users.is_deleted = ${this.bool(true)}
       )`,
      [now, now, now],
    );
  }

  async unavailableKeyIds(availableKeyIds: string[]): Promise<string[]> {
    const params = [...availableKeyIds];
    const availability =
      params.length > 0
        ? ` AND content_key_id NOT IN (${params.map((_, index) => this.p(index + 1)).join(", ")})`
        : "";
    const rows = await this.executor.all(
      `SELECT DISTINCT content_key_id FROM email_deliveries
       WHERE status IN ('pending', 'running') AND content_key_id IS NOT NULL${availability}`,
      params,
    );
    return rows.map((row) => String(row.content_key_id));
  }

  async claimReady(
    workerId: string,
    limit: number,
    availableKeyIds: string[],
  ): Promise<ClaimedEmailDelivery[]> {
    if (limit <= 0 || availableKeyIds.length === 0) return [];
    return this.executor.transaction(async () => {
      const now = nowIso();
      const keyParams = [...availableKeyIds];
      const keyPlaceholders = keyParams.map((_, index) => this.p(index + 2)).join(", ");
      const rows = await this.executor.all(
        `SELECT d.* FROM email_deliveries d JOIN users u ON u.id = d.user_id
         WHERE d.status = 'pending' AND d.next_attempt_at <= ${this.t(1)}
           AND d.content_envelope IS NOT NULL AND d.content_key_id IN (${keyPlaceholders})
           AND u.is_deleted = ${this.bool(false)}
         ORDER BY d.next_attempt_at ASC, d.id ASC LIMIT ${Math.max(1, Math.floor(limit))}
         ${this.forUpdateSkipLocked()}`,
        [now, ...keyParams],
      );
      const claimed: ClaimedEmailDelivery[] = [];
      for (const row of rows) {
        await this.executor.run(
          `UPDATE email_deliveries SET status = 'running', attempt = attempt + 1,
           locked_by = ${this.p(1)}, locked_at = ${this.t(2)}, updated_at = ${this.t(3)}
           WHERE id = ${this.p(4)} AND status = 'pending'`,
          [workerId, now, now, row.id],
        );
        claimed.push(toClaimed(row));
      }
      return claimed;
    });
  }

  async recordAttempt(result: EmailAttemptResult): Promise<void> {
    await this.executor.transaction(async () => {
      await this.executor.run(
        `INSERT INTO email_delivery_attempts
         (delivery_id, attempt_number, status, started_at, finished_at, duration_ms,
          smtp_code, error_code, error_message, created_at)
         VALUES (${this.p(1)}, ${this.p(2)}, ${this.p(3)}, ${this.t(4)}, ${this.t(5)},
          ${this.p(6)}, ${this.p(7)}, ${this.p(8)}, ${this.p(9)}, ${this.t(10)})
         ON CONFLICT (delivery_id, attempt_number) DO NOTHING`,
        [
          result.delivery.id,
          result.delivery.attempt,
          result.status,
          result.startedAt,
          result.finishedAt,
          result.durationMs,
          result.smtpCode,
          result.errorCode,
          result.errorMessage,
          result.finishedAt,
        ],
      );
      const terminal = result.status === "succeeded" || !result.retry;
      const status =
        result.status === "succeeded" ? "succeeded" : result.retry ? "pending" : "failed";
      const contentUpdate = terminal
        ? `content_envelope = NULL, content_key_id = NULL, content_purged_at = ${this.t(8)},
           locked_by = NULL, locked_at = NULL, updated_at = ${this.t(9)}
           WHERE id = ${this.p(10)}`
        : `content_envelope = content_envelope, content_key_id = content_key_id,
           content_purged_at = NULL, locked_by = NULL, locked_at = NULL,
           updated_at = ${this.t(8)} WHERE id = ${this.p(9)}`;
      await this.executor.run(
        `UPDATE email_deliveries SET status = ${this.p(1)}, next_attempt_at = ${this.t(2)},
         last_smtp_code = ${this.p(3)}, last_error_code = ${this.p(4)},
         last_error_message = ${this.p(5)}, succeeded_at = ${this.t(6)}, failed_at = ${this.t(7)},
         ${contentUpdate}`,
        terminal
          ? [
              status,
              result.nextAttemptAt ?? result.finishedAt,
              result.smtpCode,
              result.errorCode,
              result.errorMessage,
              result.status === "succeeded" ? result.finishedAt : null,
              result.status === "failed" && !result.retry ? result.finishedAt : null,
              terminal ? result.finishedAt : null,
              result.finishedAt,
              result.delivery.id,
            ]
          : [
              status,
              result.nextAttemptAt ?? result.finishedAt,
              result.smtpCode,
              result.errorCode,
              result.errorMessage,
              null,
              null,
              result.finishedAt,
              result.delivery.id,
            ],
      );
    });
  }

  async cleanup(retentionDays: number): Promise<number> {
    const cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString();
    const rows = await this.executor.all(
      `SELECT id FROM email_deliveries
       WHERE status IN ('succeeded', 'failed', 'canceled') AND updated_at < ${this.t(1)}
       ORDER BY id ASC LIMIT 1000`,
      [cutoff],
    );
    if (rows.length === 0) return 0;
    await this.executor.transaction(async () => {
      for (const row of rows) {
        await this.executor.run(
          `DELETE FROM email_delivery_attempts WHERE delivery_id = ${this.p(1)}`,
          [row.id],
        );
        await this.executor.run(`DELETE FROM email_deliveries WHERE id = ${this.p(1)}`, [row.id]);
      }
    });
    return rows.length;
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

function toClaimed(row: DatabaseRow): ClaimedEmailDelivery {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    templateCode: String(row.template_code),
    locale: String(row.locale),
    maskedRecipient: String(row.masked_recipient),
    messageId: String(row.message_id),
    contentKeyId: String(row.content_key_id),
    contentEnvelope: String(row.content_envelope),
    attempt: Number(row.attempt) + 1,
    maxAttempts: Number(row.max_attempts),
  };
}
