import type {
  CreateAnnouncementRequest,
  ListAnnouncementsQuery,
  ListCurrentAnnouncementsQuery,
  UpdateAnnouncementRequest,
} from "@web-admin-base/contracts";

import { createKnownError } from "../../core/errors/error-codes";
import type {
  AnnouncementOperations,
  AnnouncementOrganization,
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

export type AnnouncementOrganizationSource = () =>
  AnnouncementOrganization[] | Promise<AnnouncementOrganization[]>;

export class InMemoryAnnouncementRepository implements AnnouncementOperations {
  private readonly records: AnnouncementRecord[] = [];
  private sequence = 1;

  constructor(private readonly organizations: AnnouncementOrganizationSource = () => []) {}

  async listCatalog(query: ListAnnouncementsQuery): Promise<AnnouncementPage> {
    const filtered = this.records
      .filter((record) => !record.isDeleted)
      .filter((record) => !query.status || record.status === query.status)
      .filter((record) => !query.scopeType || record.scopeType === query.scopeType)
      .filter((record) => inPublishedRange(record, query.publishedFrom, query.publishedTo))
      .sort(compareUpdated);
    return page(filtered, query.page, query.pageSize);
  }

  async listCurrent(
    query: ListCurrentAnnouncementsQuery,
    currentOrganizationId: string,
  ): Promise<AnnouncementPage> {
    const organizations = await this.organizations();
    const current = organizations.find(
      (organization) => organization.id === currentOrganizationId && !organization.isDeleted,
    );
    if (!current) throw createKnownError("ORGANIZATION_NOT_FOUND");
    if (current.status === "disabled") throw createKnownError("BUSINESS_ORG_DISABLED");
    const byId = new Map(organizations.map((organization) => [organization.id, organization]));
    const now = Date.now();
    const visible = this.records
      .filter(
        (record) =>
          !record.isDeleted &&
          record.status === "published" &&
          (!record.expiresAt || Date.parse(record.expiresAt) > now),
      )
      .filter(
        (record) =>
          record.scopeType === "system" ||
          record.targetOrganizationIds.some((id) => {
            const target = byId.get(id);
            return target ? organizationCovers(target, current) : false;
          }),
      )
      .sort(comparePublished);
    return page(visible, query.page, query.pageSize);
  }

  async create(input: CreateAnnouncementRequest, actorId: string | null) {
    await this.validate(input.scopeType, input.targetOrganizationIds);
    const now = new Date().toISOString();
    const record: AnnouncementRecord = {
      id: String(this.sequence++),
      tenantId: null,
      title: input.title,
      content: input.content,
      scopeType: input.scopeType,
      targetOrganizationIds: [...input.targetOrganizationIds],
      status: "draft",
      publishedAt: null,
      expiresAt: input.expiresAt ?? null,
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
      createdAt: now,
      updatedAt: now,
      createdBy: actorId,
      updatedBy: actorId,
    };
    this.records.unshift(record);
    return clone(record);
  }

  async update(id: string, input: UpdateAnnouncementRequest, actorId: string | null) {
    const record = this.requireRecord(id);
    requireDraft(record);
    const next = resolveAnnouncementUpdate(record, input);
    await this.validate(next.scopeType, next.targetOrganizationIds);
    Object.assign(record, next, { updatedAt: new Date().toISOString(), updatedBy: actorId });
    return clone(record);
  }

  async publish(id: string, actorId: string | null) {
    const record = this.requireRecord(id);
    requireDraft(record);
    const now = new Date().toISOString();
    await this.validate(record.scopeType, record.targetOrganizationIds);
    validatePublishExpiration(record.expiresAt, now);
    Object.assign(record, {
      status: "published",
      publishedAt: now,
      updatedAt: now,
      updatedBy: actorId,
    });
    return clone(record);
  }

  async unpublish(id: string, actorId: string | null) {
    const record = this.requireRecord(id);
    requirePublished(record);
    const now = new Date().toISOString();
    Object.assign(record, {
      status: "draft",
      publishedAt: null,
      updatedAt: now,
      updatedBy: actorId,
    });
    return clone(record);
  }

  async delete(id: string, actorId: string | null) {
    const record = this.requireRecord(id);
    requireDraft(record);
    const now = new Date().toISOString();
    Object.assign(record, {
      status: "deleted",
      isDeleted: true,
      deletedAt: now,
      deletedBy: actorId,
      updatedAt: now,
      updatedBy: actorId,
    });
    return clone(record);
  }

  private requireRecord(id: string): AnnouncementRecord {
    const record = this.records.find((candidate) => candidate.id === id && !candidate.isDeleted);
    if (!record) throw createKnownError("ANNOUNCEMENT_NOT_FOUND");
    return record;
  }

  private async validate(scopeType: AnnouncementRecord["scopeType"], ids: string[]) {
    validateAnnouncementTargets(scopeType, ids, await this.organizations());
  }
}

function page(items: AnnouncementRecord[], pageNumber: number, pageSize: number): AnnouncementPage {
  const start = (pageNumber - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize).map(clone),
    page: pageNumber,
    pageSize,
    total: items.length,
  };
}

function inPublishedRange(record: AnnouncementRecord, from?: string, to?: string): boolean {
  if (!from && !to) return true;
  if (!record.publishedAt) return false;
  const timestamp = Date.parse(record.publishedAt);
  return (!from || timestamp >= Date.parse(from)) && (!to || timestamp <= Date.parse(to));
}

function compareUpdated(left: AnnouncementRecord, right: AnnouncementRecord): number {
  return right.updatedAt.localeCompare(left.updatedAt) || Number(right.id) - Number(left.id);
}

function comparePublished(left: AnnouncementRecord, right: AnnouncementRecord): number {
  return (
    (right.publishedAt ?? "").localeCompare(left.publishedAt ?? "") ||
    Number(right.id) - Number(left.id)
  );
}

function clone(record: AnnouncementRecord): AnnouncementRecord {
  return { ...record, targetOrganizationIds: [...record.targetOrganizationIds] };
}
