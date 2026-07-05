import type { UpdateI18nMessageRequest } from "@web-admin-base/contracts";

import { requestJson, stringField, unwrapRecords } from "@/lib/api-request";

export type I18nMessage = {
  id: string;
  tenantId: string | null;
  messageKey: string;
  language: string;
  messageValue: string;
  module: string;
  updatedAt: string;
};

export async function fetchI18nMessages(): Promise<I18nMessage[]> {
  const envelope = await requestJson<{ data?: unknown }>("/i18n/messages");
  return unwrapRecords(envelope.data).map(toI18nMessage);
}

export async function updateI18nMessage(id: string, input: UpdateI18nMessageRequest) {
  return requestJson<{ data: I18nMessage | null }>(`/i18n/messages/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

function toI18nMessage(record: Record<string, unknown>): I18nMessage {
  return {
    id: stringField(record.id, ""),
    tenantId: typeof record.tenantId === "string" ? record.tenantId : null,
    messageKey: stringField(record.messageKey, ""),
    language: stringField(record.language, ""),
    messageValue: stringField(record.messageValue, ""),
    module: stringField(record.module, ""),
    updatedAt: stringField(record.updatedAt, ""),
  };
}
