import {
  jsonParam,
  nowIso,
  readJson,
  type DatabaseAdapterExecutor,
  type DatabaseRow
} from "@web-admin-base/adapters";
import { loadDatabaseConfig } from "@web-admin-base/db";
import type {
  CreateAnnouncementRequest,
  CreateWebhookSubscriptionRequest,
  UpdateAnnouncementRequest,
  UpdateWebhookSubscriptionRequest
} from "@web-admin-base/contracts";

import {
  createPostgresqlInfrastructureExecutor,
  createSqliteInfrastructureExecutor
} from "../infrastructure/infrastructure.executor";
import type { AnnouncementRecord, WebhookSubscriptionRecord } from "./communications.types";

export class CommunicationsRepository {
  constructor(private readonly executor: DatabaseAdapterExecutor) {}

  static fromEnvironment(env: NodeJS.ProcessEnv = process.env): CommunicationsRepository {
    const config = loadDatabaseConfig(env);
    const executor =
      config.dialect === "postgresql"
        ? createPostgresqlInfrastructureExecutor(config.url)
        : createSqliteInfrastructureExecutor(config.url);
    return new CommunicationsRepository(executor);
  }

  close(): Promise<void> {
    return this.executor.close();
  }

  async listAnnouncements(): Promise<AnnouncementRecord[]> {
    const rows = await this.executor.all(
      `SELECT id, tenant_id, title, content, scope_type, status, published_at, is_deleted, deleted_at,
        deleted_by, created_at, updated_at, created_by, updated_by
       FROM announcements
       WHERE is_deleted = ${this.bool(false)}
       ORDER BY updated_at DESC, id DESC LIMIT 200`
    );
    return rows.map(toAnnouncement);
  }

  async createAnnouncement(input: CreateAnnouncementRequest, actorId: string | null) {
    const now = nowIso();
    const id = await this.insertAndGetId(
      `INSERT INTO announcements (title, content, scope_type, status, created_at, updated_at, created_by, updated_by)
       VALUES (${this.p(1)}, ${this.p(2)}, ${this.p(3)}, 'draft', ${this.p(4)}, ${this.p(5)}, ${this.p(6)}, ${this.p(7)})`,
      [input.title, input.content, input.scopeType, now, now, actorId, actorId]
    );
    return this.getAnnouncement(id);
  }

  async updateAnnouncement(id: string, input: UpdateAnnouncementRequest, actorId: string | null) {
    const current = (await this.listAnnouncements()).find((item) => item.id === id);
    if (!current) return null;
    const next = { ...current, ...input };
    await this.executor.run(
      `UPDATE announcements
       SET title = ${this.p(1)}, content = ${this.p(2)}, scope_type = ${this.p(3)}, updated_at = ${this.p(4)}, updated_by = ${this.p(5)}
       WHERE id = ${this.p(6)} AND is_deleted = ${this.bool(false)}`,
      [next.title, next.content, next.scopeType, nowIso(), actorId, id]
    );
    return (await this.listAnnouncements()).find((item) => item.id === id) ?? null;
  }

  async setAnnouncementPublished(id: string, published: boolean, actorId: string | null) {
    const now = nowIso();
    await this.executor.run(
      `UPDATE announcements
       SET status = ${this.p(1)}, published_at = ${this.p(2)}, updated_at = ${this.p(3)}, updated_by = ${this.p(4)}
       WHERE id = ${this.p(5)} AND is_deleted = ${this.bool(false)}`,
      [published ? "published" : "draft", published ? now : null, now, actorId, id]
    );
    return (await this.listAnnouncements()).find((item) => item.id === id) ?? null;
  }

  async listWebhooks(): Promise<WebhookSubscriptionRecord[]> {
    const rows = await this.executor.all(
      `SELECT id, tenant_id, name, url, event_types, secret, status, is_deleted, deleted_at, deleted_by,
        created_at, updated_at, created_by, updated_by
       FROM webhook_subscriptions
       WHERE is_deleted = ${this.bool(false)}
       ORDER BY updated_at DESC, id DESC LIMIT 200`
    );
    return rows.map(toWebhookSubscription);
  }

  async createWebhook(input: CreateWebhookSubscriptionRequest, actorId: string | null) {
    const now = nowIso();
    const id = await this.insertAndGetId(
      `INSERT INTO webhook_subscriptions (name, url, event_types, secret, status, created_at, updated_at, created_by, updated_by)
       VALUES (${this.p(1)}, ${this.p(2)}, ${this.p(3)}, ${this.p(4)}, ${this.p(5)}, ${this.p(6)}, ${this.p(7)}, ${this.p(8)}, ${this.p(9)})`,
      [
        input.name,
        input.url,
        jsonParam(input.eventTypes, this.executor.dialect),
        input.secret ?? null,
        input.status,
        now,
        now,
        actorId,
        actorId
      ]
    );
    return this.getWebhook(id);
  }

  async updateWebhook(id: string, input: UpdateWebhookSubscriptionRequest, actorId: string | null) {
    const current = await this.getWebhookWithSecret(id);
    if (!current) return null;
    const next = { ...current, ...input };
    await this.executor.run(
      `UPDATE webhook_subscriptions
       SET name = ${this.p(1)}, url = ${this.p(2)}, event_types = ${this.p(3)}, secret = ${this.p(4)}, status = ${this.p(5)}, updated_at = ${this.p(6)}, updated_by = ${this.p(7)}
       WHERE id = ${this.p(8)} AND is_deleted = ${this.bool(false)}`,
      [
        next.name,
        next.url,
        jsonParam(next.eventTypes, this.executor.dialect),
        next.secret ?? null,
        next.status,
        nowIso(),
        actorId,
        id
      ]
    );
    return (await this.listWebhooks()).find((item) => item.id === id) ?? null;
  }

  private async getWebhookWithSecret(id: string) {
    const rows = await this.executor.all(
      `SELECT id, name, url, event_types, secret, status
       FROM webhook_subscriptions WHERE id = ${this.p(1)} AND is_deleted = ${this.bool(false)} LIMIT 1`,
      [id]
    );
    const row = rows[0];
    if (!row) return null;
    return {
      name: String(row.name),
      url: String(row.url),
      eventTypes: readJson<string[]>(row.event_types),
      secret: nullableString(row.secret),
      status: String(row.status) as WebhookSubscriptionRecord["status"]
    };
  }

  private async getAnnouncement(id: string): Promise<AnnouncementRecord | null> {
    const rows = await this.executor.all(
      `SELECT id, tenant_id, title, content, scope_type, status, published_at, is_deleted, deleted_at,
        deleted_by, created_at, updated_at, created_by, updated_by
       FROM announcements
       WHERE id = ${this.p(1)} AND is_deleted = ${this.bool(false)} LIMIT 1`,
      [id]
    );
    return rows[0] ? toAnnouncement(rows[0]) : null;
  }

  private async getWebhook(id: string): Promise<WebhookSubscriptionRecord | null> {
    const rows = await this.executor.all(
      `SELECT id, tenant_id, name, url, event_types, secret, status, is_deleted, deleted_at, deleted_by,
        created_at, updated_at, created_by, updated_by
       FROM webhook_subscriptions
       WHERE id = ${this.p(1)} AND is_deleted = ${this.bool(false)} LIMIT 1`,
      [id]
    );
    return rows[0] ? toWebhookSubscription(rows[0]) : null;
  }

  private async insertAndGetId(sql: string, params: unknown[]): Promise<string> {
    if (this.executor.dialect === "postgresql") {
      const rows = await this.executor.all(`${sql} RETURNING id`, params);
      return String(rows[0]?.id);
    }
    await this.executor.run(sql, params);
    const rows = await this.executor.all("SELECT last_insert_rowid() AS id");
    return String(rows[0]?.id);
  }

  private p(index: number): string {
    return this.executor.dialect === "postgresql" ? `$${index}` : "?";
  }

  private bool(value: boolean): string {
    return this.executor.dialect === "postgresql" ? String(value).toUpperCase() : value ? "1" : "0";
  }
}

function toAnnouncement(row: DatabaseRow): AnnouncementRecord {
  return {
    id: String(row.id),
    tenantId: nullableId(row.tenant_id),
    title: String(row.title),
    content: String(row.content),
    scopeType: String(row.scope_type) as AnnouncementRecord["scopeType"],
    status: String(row.status) as AnnouncementRecord["status"],
    publishedAt: nullableIso(row.published_at),
    isDeleted: Boolean(row.is_deleted),
    deletedAt: nullableIso(row.deleted_at),
    deletedBy: nullableId(row.deleted_by),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    createdBy: nullableId(row.created_by),
    updatedBy: nullableId(row.updated_by)
  };
}

function toWebhookSubscription(row: DatabaseRow): WebhookSubscriptionRecord {
  return {
    id: String(row.id),
    tenantId: nullableId(row.tenant_id),
    name: String(row.name),
    url: String(row.url),
    eventTypes: readJson<string[]>(row.event_types),
    secretConfigured: Boolean(row.secret),
    status: String(row.status) as WebhookSubscriptionRecord["status"],
    isDeleted: Boolean(row.is_deleted),
    deletedAt: nullableIso(row.deleted_at),
    deletedBy: nullableId(row.deleted_by),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    createdBy: nullableId(row.created_by),
    updatedBy: nullableId(row.updated_by)
  };
}

function iso(value: unknown): string {
  return new Date(String(value)).toISOString();
}

function nullableIso(value: unknown): string | null {
  return value === null || value === undefined ? null : iso(value);
}

function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function nullableId(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}
