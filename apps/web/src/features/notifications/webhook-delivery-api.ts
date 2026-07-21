import { requestJson, stringField, unwrapRecords } from "@/lib/api-request";

export type WebhookDeliveryStatus = "pending" | "running" | "succeeded" | "failed" | "canceled";

export type WebhookDelivery = {
  id: string;
  eventId: string;
  subscriptionId: string;
  eventType: string;
  targetHost: string;
  status: WebhookDeliveryStatus;
  attempt: number;
  maxAttempts: number;
  nextAttemptAt: string;
  lastHttpStatus: number | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  succeededAt: string | null;
  failedAt: string | null;
  canceledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WebhookDeliveryAttempt = {
  id: string;
  attemptNumber: number;
  status: "succeeded" | "failed";
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  httpStatus: number | null;
  errorCode: string | null;
  errorMessage: string | null;
};

export type WebhookDeliveryFilters = {
  subscriptionId?: string;
  eventType?: string;
  status?: WebhookDeliveryStatus;
  from?: string;
  to?: string;
};

export async function fetchWebhookDeliveries(filters: WebhookDeliveryFilters = {}) {
  const params = new URLSearchParams();
  if (filters.subscriptionId) params.set("subscriptionId", filters.subscriptionId);
  if (filters.eventType) params.set("eventType", filters.eventType);
  if (filters.status) params.set("status", filters.status);
  if (filters.from) params.set("from", toIso(filters.from));
  if (filters.to) params.set("to", toIso(filters.to));
  const query = params.size ? `?${params.toString()}` : "";
  const envelope = await requestJson<{ data?: unknown }>(`/webhook-deliveries${query}`);
  const data = record(envelope.data);
  return {
    items: unwrapRecords(data.items).map(toDelivery),
    total: numberField(data.total),
  };
}

export async function fetchWebhookDelivery(id: string) {
  const envelope = await requestJson<{ data?: unknown }>(`/webhook-deliveries/${id}`);
  const data = record(envelope.data);
  return {
    ...toDelivery(data),
    attempts: unwrapRecords(data.attempts).map(toAttempt),
  };
}

function toDelivery(value: Record<string, unknown>): WebhookDelivery {
  const status = stringField(value.status, "pending");
  return {
    id: stringField(value.id, ""),
    eventId: stringField(value.eventId, ""),
    subscriptionId: stringField(value.subscriptionId, ""),
    eventType: stringField(value.eventType, ""),
    targetHost: stringField(value.targetHost, ""),
    status: isStatus(status) ? status : "pending",
    attempt: numberField(value.attempt),
    maxAttempts: numberField(value.maxAttempts),
    nextAttemptAt: stringField(value.nextAttemptAt, ""),
    lastHttpStatus: nullableNumber(value.lastHttpStatus),
    lastErrorCode: nullableString(value.lastErrorCode),
    lastErrorMessage: nullableString(value.lastErrorMessage),
    succeededAt: nullableString(value.succeededAt),
    failedAt: nullableString(value.failedAt),
    canceledAt: nullableString(value.canceledAt),
    createdAt: stringField(value.createdAt, ""),
    updatedAt: stringField(value.updatedAt, ""),
  };
}

function toAttempt(value: Record<string, unknown>): WebhookDeliveryAttempt {
  return {
    id: stringField(value.id, ""),
    attemptNumber: numberField(value.attemptNumber),
    status: value.status === "succeeded" ? "succeeded" : "failed",
    startedAt: stringField(value.startedAt, ""),
    finishedAt: stringField(value.finishedAt, ""),
    durationMs: numberField(value.durationMs),
    httpStatus: nullableNumber(value.httpStatus),
    errorCode: nullableString(value.errorCode),
    errorMessage: nullableString(value.errorMessage),
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
function isStatus(value: string): value is WebhookDeliveryStatus {
  return ["pending", "running", "succeeded", "failed", "canceled"].includes(value);
}

function toIso(value: string): string {
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? value : timestamp.toISOString();
}
