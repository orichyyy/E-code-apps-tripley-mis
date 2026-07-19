export type { AnnouncementRecord } from "./announcement.types";
export type WebhookSubscriptionStatus = "enabled" | "disabled";

export type WebhookSubscriptionRecord = {
  id: string;
  tenantId: string | null;
  name: string;
  url: string;
  eventTypes: string[];
  secretConfigured: boolean;
  revision: number;
  status: WebhookSubscriptionStatus;
  isDeleted: boolean;
  deletedAt: string | null;
  deletedBy: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
};

export type WebhookDeliveryStatus = "pending" | "running" | "succeeded" | "failed" | "canceled";

export type WebhookDeliveryRecord = {
  id: string;
  eventId: string;
  subscriptionId: string;
  subscriptionRevision: number;
  eventType: string;
  eventSource: string;
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

export type WebhookDeliveryAttemptRecord = {
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
