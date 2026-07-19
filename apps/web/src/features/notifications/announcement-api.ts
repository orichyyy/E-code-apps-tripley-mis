import type {
  CreateAnnouncementRequest,
  ListAnnouncementsQuery,
  ListCurrentAnnouncementsQuery,
  UpdateAnnouncementRequest,
} from "@web-admin-base/contracts";

import { requestJson, stringField, unwrapRecords } from "@/lib/api-request";

export type Announcement = {
  id: string;
  tenantId: string | null;
  title: string;
  content: string;
  scopeType: "system" | "organization";
  targetOrganizationIds: string[];
  status: "draft" | "published" | "deleted";
  publishedAt: string | null;
  expiresAt: string | null;
  isDeleted: boolean;
  deletedAt: string | null;
  deletedBy: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
};

export type AnnouncementPage = {
  items: Announcement[];
  page: number;
  pageSize: number;
  total: number;
};

export type AnnouncementOrganization = {
  id: string;
  name: string;
  code: string;
  path: string;
  level: number;
  status: "enabled" | "disabled";
  children: AnnouncementOrganization[];
};

export async function fetchAnnouncements(
  query: ListAnnouncementsQuery = { page: 1, pageSize: 20 },
): Promise<AnnouncementPage> {
  return fetchAnnouncementPage(`/announcements?${toQueryString(query)}`);
}

export async function fetchCurrentAnnouncements(
  query: ListCurrentAnnouncementsQuery = { page: 1, pageSize: 20 },
): Promise<AnnouncementPage> {
  return fetchAnnouncementPage(`/announcements/current?${toQueryString(query)}`);
}

export async function fetchAnnouncementOrganizations(): Promise<AnnouncementOrganization[]> {
  const envelope = await requestJson<{ data?: unknown }>("/organizations/tree");
  return unwrapRecords(envelope.data).map(toOrganization);
}

export async function createAnnouncement(input: CreateAnnouncementRequest) {
  return requestJson<{ data: Announcement }>("/announcements", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateAnnouncement(id: string, input: UpdateAnnouncementRequest) {
  return requestJson<{ data: Announcement }>(`/announcements/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function publishAnnouncement(id: string) {
  return requestJson<{ data: Announcement }>(`/announcements/${id}/publish`, {
    method: "POST",
  });
}

export async function unpublishAnnouncement(id: string) {
  return requestJson<{ data: Announcement }>(`/announcements/${id}/unpublish`, {
    method: "POST",
  });
}

export async function deleteAnnouncement(id: string) {
  return requestJson<{ data: Announcement }>(`/announcements/${id}`, { method: "DELETE" });
}

async function fetchAnnouncementPage(path: string): Promise<AnnouncementPage> {
  const envelope = await requestJson<{ data?: unknown }>(path);
  const data = isRecord(envelope.data) ? envelope.data : {};
  return {
    items: unwrapRecords(data).map(toAnnouncement),
    page: numberField(data.page, 1),
    pageSize: numberField(data.pageSize, 20),
    total: numberField(data.total, 0),
  };
}

function toAnnouncement(record: Record<string, unknown>): Announcement {
  return {
    id: stringField(record.id, ""),
    tenantId: typeof record.tenantId === "string" ? record.tenantId : null,
    title: stringField(record.title, ""),
    content: stringField(record.content, ""),
    scopeType: record.scopeType === "organization" ? "organization" : "system",
    targetOrganizationIds: Array.isArray(record.targetOrganizationIds)
      ? record.targetOrganizationIds.filter((id): id is string => typeof id === "string")
      : [],
    status: toAnnouncementStatus(record.status),
    publishedAt: nullableString(record.publishedAt),
    expiresAt: nullableString(record.expiresAt),
    isDeleted: record.isDeleted === true,
    deletedAt: nullableString(record.deletedAt),
    deletedBy: nullableString(record.deletedBy),
    createdAt: stringField(record.createdAt, ""),
    updatedAt: stringField(record.updatedAt, ""),
    createdBy: nullableString(record.createdBy),
    updatedBy: nullableString(record.updatedBy),
  };
}

function toOrganization(record: Record<string, unknown>): AnnouncementOrganization {
  return {
    id: stringField(record.id, ""),
    name: stringField(record.name, ""),
    code: stringField(record.code, ""),
    path: stringField(record.path, "0"),
    level: numberField(record.level, 1),
    status: record.status === "disabled" ? "disabled" : "enabled",
    children: unwrapRecords(record.children).map(toOrganization),
  };
}

function toQueryString(query: Record<string, unknown>): string {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  });
  return params.toString();
}

function toAnnouncementStatus(value: unknown): Announcement["status"] {
  if (value === "published" || value === "deleted") return value;
  return "draft";
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function numberField(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
