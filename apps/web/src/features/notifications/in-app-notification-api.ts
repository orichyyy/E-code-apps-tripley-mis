import { requestJson, stringField, unwrapRecords } from "@/lib/api-request";

export type InAppNotification = {
  id: string;
  userId: string | null;
  channel: string;
  title: string;
  body: string;
  status: "unread" | "read" | "archived" | "deleted";
  metadata: Record<string, unknown>;
  readAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function fetchInAppNotifications(): Promise<InAppNotification[]> {
  const envelope = await requestJson<{ data?: unknown }>("/notifications");
  return unwrapRecords(envelope.data).map(toInAppNotification);
}

export async function markNotificationRead(id: string) {
  return requestJson<{ data: InAppNotification | NotificationStateResponse }>(`/notifications/${id}/read`, {
    method: "POST"
  });
}

export async function archiveNotification(id: string) {
  return requestJson<{ data: InAppNotification | NotificationStateResponse }>(`/notifications/${id}/archive`, {
    method: "POST"
  });
}

export async function deleteNotification(id: string) {
  return requestJson<{ data: InAppNotification | NotificationStateResponse }>(`/notifications/${id}`, {
    method: "DELETE"
  });
}

type NotificationStateResponse = {
  id: string;
  status: InAppNotification["status"];
};

function toInAppNotification(record: Record<string, unknown>): InAppNotification {
  return {
    id: stringField(record.id, ""),
    userId: typeof record.userId === "string" ? record.userId : null,
    channel: stringField(record.channel, "in_app"),
    title: stringField(record.title, ""),
    body: stringField(record.body, ""),
    status: toNotificationStatus(record.status),
    metadata: isObjectRecord(record.metadata) ? record.metadata : {},
    readAt: typeof record.readAt === "string" ? record.readAt : null,
    archivedAt: typeof record.archivedAt === "string" ? record.archivedAt : null,
    createdAt: stringField(record.createdAt, ""),
    updatedAt: stringField(record.updatedAt, "")
  };
}

function toNotificationStatus(value: unknown): InAppNotification["status"] {
  if (value === "read" || value === "archived" || value === "deleted") return value;
  return "unread";
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
