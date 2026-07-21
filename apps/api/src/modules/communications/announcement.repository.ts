import { nowIso, type DatabaseAdapterExecutor } from "@web-admin-base/adapters";
import type {
  CreateAnnouncementRequest,
  ListAnnouncementsQuery,
  ListCurrentAnnouncementsQuery,
  UpdateAnnouncementRequest,
} from "@web-admin-base/contracts";

import { createKnownError } from "../../core/errors/error-codes";
import { AnnouncementDatabase, selectAnnouncement, toAnnouncement } from "./announcement.database";
import type {
  AnnouncementOperations,
  AnnouncementPage,
  AnnouncementRecord,
} from "./announcement.types";
import {
  organizationCovers,
  requireDraft,
  requirePublished,
  resolveAnnouncementUpdate,
  validateAnnouncementTargets,
  validatePublishExpiration,
} from "./announcement.validation";

export class AnnouncementRepository implements AnnouncementOperations {
  private readonly database: AnnouncementDatabase;

  constructor(private readonly executor: DatabaseAdapterExecutor) {
    this.database = new AnnouncementDatabase(executor);
  }

  async listCatalog(query: ListAnnouncementsQuery): Promise<AnnouncementPage> {
    const filter = this.catalogFilter(query);
    const countRows = await this.executor.all(
      `SELECT COUNT(*) AS count FROM announcements ${filter.sql}`,
      filter.params,
    );
    const pagination = [query.pageSize, (query.page - 1) * query.pageSize];
    const rows = await this.executor.all(
      `${selectAnnouncement} ${filter.sql} ORDER BY updated_at DESC, id DESC
       LIMIT ${this.p(filter.params.length + 1)} OFFSET ${this.p(filter.params.length + 2)}`,
      [...filter.params, ...pagination],
    );
    return {
      items: await this.database.attachTargets(rows.map(toAnnouncement)),
      page: query.page,
      pageSize: query.pageSize,
      total: Number(countRows[0]?.count ?? 0),
    };
  }

  async listCurrent(
    query: ListCurrentAnnouncementsQuery,
    currentOrganizationId: string,
  ): Promise<AnnouncementPage> {
    const current = await this.database.getOrganization(currentOrganizationId);
    if (!current || current.isDeleted) throw createKnownError("ORGANIZATION_NOT_FOUND");
    if (current.status === "disabled") throw createKnownError("BUSINESS_ORG_DISABLED");
    const now = nowIso();
    const rows = await this.executor.all(
      `${selectAnnouncement}
       WHERE is_deleted = ${this.bool(false)} AND status = 'published'
         AND (expire_at IS NULL OR expire_at > ${this.p(1)})
       ORDER BY published_at DESC, id DESC`,
      [now],
    );
    const records = await this.database.attachTargets(rows.map(toAnnouncement));
    const targetIds = [...new Set(records.flatMap((record) => record.targetOrganizationIds))];
    const targets = new Map(
      (await this.database.getOrganizations(targetIds)).map((item) => [item.id, item]),
    );
    const visible = records.filter(
      (record) =>
        record.scopeType === "system" ||
        record.targetOrganizationIds.some((id) => {
          const target = targets.get(id);
          return target ? organizationCovers(target, current) : false;
        }),
    );
    const start = (query.page - 1) * query.pageSize;
    return {
      items: visible.slice(start, start + query.pageSize),
      page: query.page,
      pageSize: query.pageSize,
      total: visible.length,
    };
  }

  async create(input: CreateAnnouncementRequest, actorId: string | null) {
    return this.executor.transaction(async () => {
      await this.validateTargets(input.scopeType, input.targetOrganizationIds);
      const now = nowIso();
      const sql = `INSERT INTO announcements
        (title, content, scope_type, status, published_at, expire_at, created_at, updated_at, created_by, updated_by)
        VALUES (${this.values(10)})`;
      const id = await this.database.insertAndGetId(sql, [
        input.title,
        input.content,
        input.scopeType,
        "draft",
        null,
        input.expiresAt ?? null,
        now,
        now,
        actorId,
        actorId,
      ]);
      await this.database.replaceTargets(id, input.targetOrganizationIds);
      return this.database.requireRecord(id);
    });
  }

  async update(id: string, input: UpdateAnnouncementRequest, actorId: string | null) {
    return this.executor.transaction(async () => {
      const current = await this.database.requireRecord(id);
      requireDraft(current);
      const next = resolveAnnouncementUpdate(current, input);
      await this.validateTargets(next.scopeType, next.targetOrganizationIds);
      await this.executor.run(
        `UPDATE announcements SET title = ${this.p(1)}, content = ${this.p(2)},
          scope_type = ${this.p(3)}, expire_at = ${this.p(4)}, updated_at = ${this.p(5)},
          updated_by = ${this.p(6)} WHERE id = ${this.p(7)} AND is_deleted = ${this.bool(false)}`,
        [next.title, next.content, next.scopeType, next.expiresAt, nowIso(), actorId, id],
      );
      await this.database.replaceTargets(id, next.targetOrganizationIds);
      return this.database.requireRecord(id);
    });
  }

  async publish(id: string, actorId: string | null) {
    return this.executor.transaction(async () => {
      const current = await this.database.requireRecord(id);
      requireDraft(current);
      const now = nowIso();
      await this.validateTargets(current.scopeType, current.targetOrganizationIds);
      validatePublishExpiration(current.expiresAt, now);
      await this.executor.run(
        `UPDATE announcements SET status = 'published', published_at = ${this.p(1)},
          updated_at = ${this.p(2)}, updated_by = ${this.p(3)}
         WHERE id = ${this.p(4)} AND is_deleted = ${this.bool(false)}`,
        [now, now, actorId, id],
      );
      return this.database.requireRecord(id);
    });
  }

  async unpublish(id: string, actorId: string | null) {
    return this.executor.transaction(async () => {
      const current = await this.database.requireRecord(id);
      requirePublished(current);
      const now = nowIso();
      await this.executor.run(
        `UPDATE announcements SET status = 'draft', published_at = NULL,
          updated_at = ${this.p(1)}, updated_by = ${this.p(2)}
         WHERE id = ${this.p(3)} AND is_deleted = ${this.bool(false)}`,
        [now, actorId, id],
      );
      return this.database.requireRecord(id);
    });
  }

  async delete(id: string, actorId: string | null): Promise<AnnouncementRecord> {
    return this.executor.transaction(async () => {
      const current = await this.database.requireRecord(id);
      requireDraft(current);
      const now = nowIso();
      await this.executor.run(
        `UPDATE announcements SET status = 'deleted', is_deleted = ${this.bool(true)},
          deleted_at = ${this.p(1)}, deleted_by = ${this.p(2)}, updated_at = ${this.p(3)},
          updated_by = ${this.p(4)} WHERE id = ${this.p(5)} AND is_deleted = ${this.bool(false)}`,
        [now, actorId, now, actorId, id],
      );
      return {
        ...current,
        status: "deleted",
        isDeleted: true,
        deletedAt: now,
        deletedBy: actorId,
        updatedAt: now,
        updatedBy: actorId,
      };
    });
  }

  private async validateTargets(scopeType: AnnouncementRecord["scopeType"], ids: string[]) {
    validateAnnouncementTargets(scopeType, ids, await this.database.getOrganizations(ids));
  }

  private catalogFilter(query: ListAnnouncementsQuery): { sql: string; params: unknown[] } {
    const clauses = [`is_deleted = ${this.bool(false)}`];
    const params: unknown[] = [];
    const add = (column: string, operator: string, value: unknown) => {
      params.push(value);
      clauses.push(`${column} ${operator} ${this.p(params.length)}`);
    };
    if (query.status) add("status", "=", query.status);
    if (query.scopeType) add("scope_type", "=", query.scopeType);
    if (query.publishedFrom) add("published_at", ">=", query.publishedFrom);
    if (query.publishedTo) add("published_at", "<=", query.publishedTo);
    return { sql: `WHERE ${clauses.join(" AND ")}`, params };
  }

  private values(count: number): string {
    return this.database.values(count);
  }

  private placeholders(count: number): string {
    return this.database.placeholders(count);
  }

  private p(index: number): string {
    return this.database.p(index);
  }

  private bool(value: boolean): string {
    return this.database.bool(value);
  }
}
