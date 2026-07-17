import { nowIso, type DatabaseAdapterExecutor, type DatabaseRow } from "@web-admin-base/adapters";
import { loadDatabaseConfig } from "@web-admin-base/db";
import type {
  CreateAnnouncementRequest,
  UpdateAnnouncementRequest,
} from "@web-admin-base/contracts";

import {
  createPostgresqlInfrastructureExecutor,
  createSqliteInfrastructureExecutor,
} from "../infrastructure/infrastructure.executor";
import type { AnnouncementRecord } from "./communications.types";
import { WebhookRepository } from "./webhook.repository";

export class CommunicationsRepository {
  readonly webhooks: WebhookRepository;

  constructor(private readonly executor: DatabaseAdapterExecutor) {
    this.webhooks = new WebhookRepository(executor);
  }

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
       ORDER BY updated_at DESC, id DESC LIMIT 200`,
    );
    return rows.map(toAnnouncement);
  }

  async createAnnouncement(input: CreateAnnouncementRequest, actorId: string | null) {
    const now = nowIso();
    const id = await this.insertAndGetId(
      `INSERT INTO announcements (title, content, scope_type, status, created_at, updated_at, created_by, updated_by)
       VALUES (${this.p(1)}, ${this.p(2)}, ${this.p(3)}, 'draft', ${this.p(4)}, ${this.p(5)}, ${this.p(6)}, ${this.p(7)})`,
      [input.title, input.content, input.scopeType, now, now, actorId, actorId],
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
      [next.title, next.content, next.scopeType, nowIso(), actorId, id],
    );
    return (await this.listAnnouncements()).find((item) => item.id === id) ?? null;
  }

  async setAnnouncementPublished(id: string, published: boolean, actorId: string | null) {
    const now = nowIso();
    await this.executor.run(
      `UPDATE announcements
       SET status = ${this.p(1)}, published_at = ${this.p(2)}, updated_at = ${this.p(3)}, updated_by = ${this.p(4)}
       WHERE id = ${this.p(5)} AND is_deleted = ${this.bool(false)}`,
      [published ? "published" : "draft", published ? now : null, now, actorId, id],
    );
    return (await this.listAnnouncements()).find((item) => item.id === id) ?? null;
  }

  private async getAnnouncement(id: string): Promise<AnnouncementRecord | null> {
    const rows = await this.executor.all(
      `SELECT id, tenant_id, title, content, scope_type, status, published_at, is_deleted, deleted_at,
        deleted_by, created_at, updated_at, created_by, updated_by
       FROM announcements
       WHERE id = ${this.p(1)} AND is_deleted = ${this.bool(false)} LIMIT 1`,
      [id],
    );
    return rows[0] ? toAnnouncement(rows[0]) : null;
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
    updatedBy: nullableId(row.updated_by),
  };
}

function iso(value: unknown): string {
  return new Date(String(value)).toISOString();
}

function nullableIso(value: unknown): string | null {
  return value === null || value === undefined ? null : iso(value);
}

function nullableId(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}
