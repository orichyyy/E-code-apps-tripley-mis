import type { CreateAnnouncementRequest, UpdateAnnouncementRequest } from "@web-admin-base/contracts";

import { requestJson, stringField, unwrapRecords } from "@/lib/api-request";

export type Announcement = {
  id: string;
  tenantId: string | null;
  title: string;
  content: string;
  scopeType: "system" | "organization";
  status: "draft" | "published" | "deleted";
  publishedAt: string | null;
  isDeleted: boolean;
  deletedAt: string | null;
  deletedBy: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
};

export async function fetchAnnouncements(): Promise<Announcement[]> {
  const envelope = await requestJson<{ data?: unknown }>("/announcements");
  return unwrapRecords(envelope.data).map(toAnnouncement);
}

export async function createAnnouncement(input: CreateAnnouncementRequest) {
  return requestJson<{ data: Announcement }>("/announcements", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function updateAnnouncement(id: string, input: UpdateAnnouncementRequest) {
  return requestJson<{ data: Announcement | null }>(`/announcements/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export async function publishAnnouncement(id: string) {
  return requestJson<{ data: Announcement | null }>(`/announcements/${id}/publish`, {
    method: "POST"
  });
}

export async function unpublishAnnouncement(id: string) {
  return requestJson<{ data: Announcement | null }>(`/announcements/${id}/unpublish`, {
    method: "POST"
  });
}

function toAnnouncement(record: Record<string, unknown>): Announcement {
  return {
    id: stringField(record.id, ""),
    tenantId: typeof record.tenantId === "string" ? record.tenantId : null,
    title: stringField(record.title, ""),
    content: stringField(record.content, ""),
    scopeType: record.scopeType === "organization" ? "organization" : "system",
    status: toAnnouncementStatus(record.status),
    publishedAt: typeof record.publishedAt === "string" ? record.publishedAt : null,
    isDeleted: record.isDeleted === true,
    deletedAt: typeof record.deletedAt === "string" ? record.deletedAt : null,
    deletedBy: typeof record.deletedBy === "string" ? record.deletedBy : null,
    createdAt: stringField(record.createdAt, ""),
    updatedAt: stringField(record.updatedAt, ""),
    createdBy: typeof record.createdBy === "string" ? record.createdBy : null,
    updatedBy: typeof record.updatedBy === "string" ? record.updatedBy : null
  };
}

function toAnnouncementStatus(value: unknown): Announcement["status"] {
  if (value === "published" || value === "deleted") return value;
  return "draft";
}
