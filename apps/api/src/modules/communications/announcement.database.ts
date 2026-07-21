import type { DatabaseAdapterExecutor, DatabaseRow } from "@web-admin-base/adapters";

import { createKnownError } from "../../core/errors/error-codes";
import type { AnnouncementOrganization, AnnouncementRecord } from "./announcement.types";

export const selectAnnouncement = `SELECT id, tenant_id, title, content, scope_type, status,
  published_at, expire_at, is_deleted, deleted_at, deleted_by, created_at, updated_at,
  created_by, updated_by FROM announcements`;

export class AnnouncementDatabase {
  constructor(readonly executor: DatabaseAdapterExecutor) {}

  async requireRecord(id: string): Promise<AnnouncementRecord> {
    const rows = await this.executor.all(
      `${selectAnnouncement} WHERE id = ${this.p(1)} AND is_deleted = ${this.bool(false)} LIMIT 1`,
      [id],
    );
    if (!rows[0]) throw createKnownError("ANNOUNCEMENT_NOT_FOUND");
    return (await this.attachTargets([toAnnouncement(rows[0])]))[0] as AnnouncementRecord;
  }

  async attachTargets(records: AnnouncementRecord[]): Promise<AnnouncementRecord[]> {
    if (records.length === 0) return records;
    const ids = records.map((record) => record.id);
    const rows = await this.executor.all(
      `SELECT announcement_id, target_id FROM announcement_targets
       WHERE announcement_id IN (${this.placeholders(ids.length)}) ORDER BY id`,
      ids,
    );
    const targets = new Map<string, string[]>();
    rows.forEach((row) => {
      const announcementId = String(row.announcement_id);
      targets.set(announcementId, [...(targets.get(announcementId) ?? []), String(row.target_id)]);
    });
    return records.map((record) => ({
      ...record,
      targetOrganizationIds: targets.get(record.id) ?? [],
    }));
  }

  async getOrganizations(ids: string[]): Promise<AnnouncementOrganization[]> {
    if (ids.length === 0) return [];
    const rows = await this.executor.all(
      `SELECT id, path, level, status, is_deleted FROM organizations
       WHERE id IN (${this.placeholders(ids.length)})`,
      ids,
    );
    return rows.map(toOrganization);
  }

  async getOrganization(id: string): Promise<AnnouncementOrganization | null> {
    const rows = await this.executor.all(
      `SELECT id, path, level, status, is_deleted FROM organizations WHERE id = ${this.p(1)} LIMIT 1`,
      [id],
    );
    return rows[0] ? toOrganization(rows[0]) : null;
  }

  async replaceTargets(announcementId: string, targetIds: string[]): Promise<void> {
    await this.executor.run(
      `DELETE FROM announcement_targets WHERE announcement_id = ${this.p(1)}`,
      [announcementId],
    );
    for (const targetId of targetIds) {
      await this.executor.run(
        `INSERT INTO announcement_targets (announcement_id, target_type, target_id)
         VALUES (${this.p(1)}, 'organization', ${this.p(2)})`,
        [announcementId, targetId],
      );
    }
  }

  async insertAndGetId(sql: string, params: unknown[]): Promise<string> {
    if (this.executor.dialect === "postgresql") {
      const rows = await this.executor.all(`${sql} RETURNING id`, params);
      return String(rows[0]?.id);
    }
    await this.executor.run(sql, params);
    const rows = await this.executor.all("SELECT last_insert_rowid() AS id");
    return String(rows[0]?.id);
  }

  values(count: number): string {
    return Array.from({ length: count }, (_, index) => this.p(index + 1)).join(", ");
  }

  placeholders(count: number): string {
    return Array.from({ length: count }, (_, index) => this.p(index + 1)).join(", ");
  }

  p(index: number): string {
    return this.executor.dialect === "postgresql" ? `$${index}` : "?";
  }

  bool(value: boolean): string {
    return this.executor.dialect === "postgresql" ? String(value).toUpperCase() : value ? "1" : "0";
  }
}

export function toAnnouncement(row: DatabaseRow): AnnouncementRecord {
  return {
    id: String(row.id),
    tenantId: nullableId(row.tenant_id),
    title: String(row.title),
    content: String(row.content),
    scopeType: String(row.scope_type) as AnnouncementRecord["scopeType"],
    targetOrganizationIds: [],
    status: String(row.status) as AnnouncementRecord["status"],
    publishedAt: nullableIso(row.published_at),
    expiresAt: nullableIso(row.expire_at),
    isDeleted: Boolean(row.is_deleted),
    deletedAt: nullableIso(row.deleted_at),
    deletedBy: nullableId(row.deleted_by),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    createdBy: nullableId(row.created_by),
    updatedBy: nullableId(row.updated_by),
  };
}

function toOrganization(row: DatabaseRow): AnnouncementOrganization {
  return {
    id: String(row.id),
    path: String(row.path),
    level: Number(row.level),
    status: String(row.status) as AnnouncementOrganization["status"],
    isDeleted: Boolean(row.is_deleted),
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
