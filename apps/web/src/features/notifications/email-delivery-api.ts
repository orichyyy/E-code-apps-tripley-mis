import { requestJson, stringField, unwrapRecords } from "@/lib/api-request";

export type EmailDeliveryStatus = "pending" | "running" | "succeeded" | "failed" | "canceled";
export type EmailDeliveryFilters = {
  userId?: string;
  templateCode?: string;
  locale?: string;
  status?: EmailDeliveryStatus;
  from?: string;
  to?: string;
};

export type EmailDelivery = {
  id: string;
  requestKey: string;
  userId: string;
  templateCode: string;
  locale: string;
  maskedRecipient: string;
  status: EmailDeliveryStatus;
  attempt: number;
  maxAttempts: number;
  createdAt: string;
  succeededAt: string | null;
  failedAt: string | null;
  canceledAt: string | null;
  contentPurgedAt: string | null;
};

export type EmailDeliveryDetail = EmailDelivery & {
  referenceType: string | null;
  referenceId: string | null;
  lastSmtpCode: number | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  attempts: Array<{
    id: string;
    attemptNumber: number;
    status: "succeeded" | "failed";
    durationMs: number;
    smtpCode: number | null;
    errorCode: string | null;
    errorMessage: string | null;
    finishedAt: string;
  }>;
};

export async function fetchEmailDeliveries(filters: EmailDeliveryFilters = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (!value) continue;
    params.set(key, key === "from" || key === "to" ? toIso(value) : value);
  }
  const query = params.size > 0 ? `?${params.toString()}` : "";
  const envelope = await requestJson<{ data?: unknown }>(`/email-deliveries${query}`);
  const data = record(envelope.data);
  return { items: unwrapRecords(data.items).map(toDelivery), total: numberField(data.total) };
}

export async function fetchEmailDelivery(id: string): Promise<EmailDeliveryDetail> {
  const envelope = await requestJson<{ data?: unknown }>(`/email-deliveries/${id}`);
  const data = record(envelope.data);
  return {
    ...toDelivery(data),
    referenceType: nullableString(data.referenceType),
    referenceId: nullableString(data.referenceId),
    lastSmtpCode: nullableNumber(data.lastSmtpCode),
    lastErrorCode: nullableString(data.lastErrorCode),
    lastErrorMessage: nullableString(data.lastErrorMessage),
    attempts: unwrapRecords(data.attempts).map((attempt) => ({
      id: stringField(attempt.id, ""),
      attemptNumber: numberField(attempt.attemptNumber),
      status: attempt.status === "succeeded" ? "succeeded" : "failed",
      durationMs: numberField(attempt.durationMs),
      smtpCode: nullableNumber(attempt.smtpCode),
      errorCode: nullableString(attempt.errorCode),
      errorMessage: nullableString(attempt.errorMessage),
      finishedAt: stringField(attempt.finishedAt, ""),
    })),
  };
}

function toDelivery(value: Record<string, unknown>): EmailDelivery {
  const status = stringField(value.status, "pending");
  return {
    id: stringField(value.id, ""),
    requestKey: stringField(value.requestKey, ""),
    userId: stringField(value.userId, ""),
    templateCode: stringField(value.templateCode, ""),
    locale: stringField(value.locale, ""),
    maskedRecipient: stringField(value.maskedRecipient, ""),
    status: isStatus(status) ? status : "pending",
    attempt: numberField(value.attempt),
    maxAttempts: numberField(value.maxAttempts),
    createdAt: stringField(value.createdAt, ""),
    succeededAt: nullableString(value.succeededAt),
    failedAt: nullableString(value.failedAt),
    canceledAt: nullableString(value.canceledAt),
    contentPurgedAt: nullableString(value.contentPurgedAt),
  };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function numberField(value: unknown): number {
  return typeof value === "number" ? value : Number(value ?? 0);
}
function nullableNumber(value: unknown): number | null {
  return value == null ? null : numberField(value);
}
function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
function isStatus(value: string): value is EmailDeliveryStatus {
  return ["pending", "running", "succeeded", "failed", "canceled"].includes(value);
}
function toIso(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}
