import type {
  CreateExportTaskRequest,
  CreateScheduledTaskRequest,
  UpdateScheduledTaskRequest
} from "@web-admin-base/contracts";

import { requestJson, unwrapRecords } from "@/lib/api-request";
import {
  asRecord,
  booleanValue,
  nullableString,
  numberValue,
  objectValue,
  stringValue
} from "./record-utils";

export type OnlineUser = {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  organizationId: string;
  organizationName: string;
  ipAddress: string | null;
  userAgent: string | null;
  currentOrganizationId: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  status: string;
};

export type ScheduledTask = {
  id: string;
  code: string;
  cronExpression: string;
  handlerType: string;
  payload: Record<string, unknown>;
  enabled: boolean;
  status: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
  attempt: number;
  maxAttempts: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ImportExportTask = {
  id: string;
  taskType: "import" | "export" | string;
  resourceType: string;
  status: string;
  fileObjectId: string | null;
  resultFileObjectId: string | null;
  errorFileObjectId: string | null;
  totalRows: number;
  successRows: number;
  failedRows: number;
  errorPreview: Array<Record<string, unknown>>;
  resultExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
};

export async function fetchOnlineUsers(): Promise<OnlineUser[]> {
  const envelope = await requestJson<{ data: unknown }>("/online-users");
  return unwrapRecords(envelope.data).map(toOnlineUser);
}

export async function fetchScheduledTasks(): Promise<ScheduledTask[]> {
  const envelope = await requestJson<{ data: unknown }>("/scheduled-tasks");
  return unwrapRecords(envelope.data).map(toScheduledTask);
}

export async function createScheduledTask(input: CreateScheduledTaskRequest) {
  return requestJson<{ data: ScheduledTask }>("/scheduled-tasks", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function updateScheduledTask(id: string, input: UpdateScheduledTaskRequest) {
  return requestJson<{ data: ScheduledTask | null }>(`/scheduled-tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export async function setScheduledTaskStatus(id: string, enabled: boolean) {
  return requestJson<{ data: ScheduledTask | null }>(`/scheduled-tasks/${id}/${enabled ? "enable" : "disable"}`, {
    method: "POST"
  });
}

export async function runScheduledTask(id: string) {
  return requestJson<{ data: ScheduledTask | null }>(`/scheduled-tasks/${id}/run`, {
    method: "POST"
  });
}

export async function fetchImportExportTasks(): Promise<ImportExportTask[]> {
  const envelope = await requestJson<{ data: unknown }>("/import-export/tasks");
  return unwrapRecords(envelope.data).map(toImportExportTask);
}

export async function fetchImportExportTask(id: string): Promise<ImportExportTask | null> {
  const envelope = await requestJson<{ data: unknown }>(`/import-export/tasks/${id}`);
  return envelope.data ? toImportExportTask(asRecord(envelope.data)) : null;
}

export async function createExportTask(input: CreateExportTaskRequest) {
  return requestJson<{ data: ImportExportTask }>("/import-export/export", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

function toOnlineUser(record: Record<string, unknown>): OnlineUser {
  return {
    id: stringValue(record.id, stringValue(record.sessionId)),
    userId: stringValue(record.userId),
    username: stringValue(record.username, stringValue(record.userName)),
    displayName: stringValue(record.displayName, stringValue(record.name, stringValue(record.username))),
    organizationId: stringValue(record.organizationId, stringValue(record.currentOrganizationId)),
    organizationName: stringValue(record.organizationName, stringValue(record.currentOrganizationName)),
    ipAddress: nullableString(record.ipAddress),
    userAgent: nullableString(record.userAgent),
    currentOrganizationId: stringValue(record.currentOrganizationId, stringValue(record.organizationId)),
    createdAt: stringValue(record.createdAt),
    lastSeenAt: stringValue(record.lastSeenAt, stringValue(record.updatedAt)),
    expiresAt: stringValue(record.expiresAt),
    status: stringValue(record.status, "active")
  };
}

function toScheduledTask(record: Record<string, unknown>): ScheduledTask {
  return {
    id: stringValue(record.id),
    code: stringValue(record.code),
    cronExpression: stringValue(record.cronExpression),
    handlerType: stringValue(record.handlerType),
    payload: objectValue(record.payload),
    enabled: booleanValue(record.enabled, stringValue(record.status) === "enabled"),
    status: stringValue(record.status, booleanValue(record.enabled) ? "enabled" : "disabled"),
    lastRunAt: nullableString(record.lastRunAt),
    nextRunAt: nullableString(record.nextRunAt),
    attempt: numberValue(record.attempt),
    maxAttempts: numberValue(record.maxAttempts),
    lastError: nullableString(record.lastError),
    createdAt: stringValue(record.createdAt),
    updatedAt: stringValue(record.updatedAt)
  };
}

function toImportExportTask(record: Record<string, unknown>): ImportExportTask {
  return {
    id: stringValue(record.id),
    taskType: stringValue(record.taskType),
    resourceType: stringValue(record.resourceType),
    status: stringValue(record.status),
    fileObjectId: nullableString(record.fileObjectId),
    resultFileObjectId: nullableString(record.resultFileObjectId),
    errorFileObjectId: nullableString(record.errorFileObjectId),
    totalRows: numberValue(record.totalRows),
    successRows: numberValue(record.successRows),
    failedRows: numberValue(record.failedRows),
    errorPreview: Array.isArray(record.errorPreview) ? record.errorPreview.map(asRecord) : [],
    resultExpiresAt: nullableString(record.resultExpiresAt),
    createdAt: stringValue(record.createdAt),
    updatedAt: stringValue(record.updatedAt),
    createdBy: nullableString(record.createdBy)
  };
}
