import type {
  CreateNotificationTemplateRequest,
  UpdateNotificationTemplateRequest
} from "@web-admin-base/contracts";

import { requestJson, stringField, unwrapRecords } from "@/lib/api-request";

export type NotificationTemplate = {
  id: string;
  code: string;
  channel: "in_app" | "email" | "sms";
  locale: string;
  subject: string | null;
  body: string;
  variables: string[];
  status: "enabled" | "disabled";
  createdAt: string;
  updatedAt: string;
};

export async function fetchNotificationTemplates(): Promise<NotificationTemplate[]> {
  const envelope = await requestJson<{ data?: unknown }>("/notification-templates");
  return unwrapRecords(envelope.data).map(toNotificationTemplate);
}

export async function createNotificationTemplate(input: CreateNotificationTemplateRequest) {
  return requestJson<{ data: NotificationTemplate }>("/notification-templates", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function updateNotificationTemplate(id: string, input: UpdateNotificationTemplateRequest) {
  return requestJson<{ data: NotificationTemplate }>(`/notification-templates/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

function toNotificationTemplate(record: Record<string, unknown>): NotificationTemplate {
  return {
    id: stringField(record.id, ""),
    code: stringField(record.code, ""),
    channel: toNotificationChannel(record.channel),
    locale: stringField(record.locale, ""),
    subject: typeof record.subject === "string" ? record.subject : null,
    body: stringField(record.body, ""),
    variables: Array.isArray(record.variables)
      ? record.variables.filter((value): value is string => typeof value === "string")
      : [],
    status: record.status === "disabled" ? "disabled" : "enabled",
    createdAt: stringField(record.createdAt, ""),
    updatedAt: stringField(record.updatedAt, "")
  };
}

function toNotificationChannel(value: unknown): NotificationTemplate["channel"] {
  return value === "email" || value === "sms" ? value : "in_app";
}
