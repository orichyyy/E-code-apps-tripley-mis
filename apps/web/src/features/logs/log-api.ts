import type { CreateLogExportTaskRequest } from "@web-admin-base/contracts";

import { requestJson, unwrapRecords } from "@/lib/api-request";
import {
  nullableString,
  numberValue,
  objectValue,
  stringValue,
} from "@/features/operations/record-utils";
import type { ImportExportTask } from "@/features/operations/operations-api";

export type LogRouteCode =
  | "logs.login"
  | "logs.operation"
  | "logs.access"
  | "logs.api"
  | "logs.exception"
  | "logs.security"
  | "logs.scheduler"
  | "logs.files";

export type LogType = CreateLogExportTaskRequest["logType"];

export type LogEntry = {
  id: string;
  logType: LogType | string;
  level: string;
  message: string;
  traceId: string | null;
  userId: string | null;
  ipAddress: string | null;
  metadata: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
};

const logConfigByRouteCode: Record<LogRouteCode, { endpoint: string; logType: LogType }> = {
  "logs.login": { endpoint: "/logs/login", logType: "login" },
  "logs.operation": { endpoint: "/logs/operation", logType: "operation" },
  "logs.access": { endpoint: "/logs/access", logType: "access" },
  "logs.api": { endpoint: "/logs/api", logType: "api_call" },
  "logs.exception": { endpoint: "/logs/exception", logType: "exception" },
  "logs.security": { endpoint: "/logs/security", logType: "security" },
  "logs.scheduler": { endpoint: "/logs/jobs", logType: "scheduler" },
  "logs.files": { endpoint: "/logs/files", logType: "file_operation" },
};

export function isLogRouteCode(routeCode: string): routeCode is LogRouteCode {
  return routeCode in logConfigByRouteCode;
}

export function getLogType(routeCode: LogRouteCode): LogType {
  return logConfigByRouteCode[routeCode].logType;
}

export async function fetchLogs(routeCode: LogRouteCode): Promise<LogEntry[]> {
  const envelope = await requestJson<{ data: unknown }>(logConfigByRouteCode[routeCode].endpoint);
  return unwrapRecords(envelope.data).map(toLogEntry);
}

export async function createLogExportTask(logType: LogType): Promise<ImportExportTask> {
  const envelope = await requestJson<{ data: unknown }>("/logs/export", {
    method: "POST",
    body: JSON.stringify({ logType }),
  });
  return toImportExportTask(envelope.data);
}

function toLogEntry(record: Record<string, unknown>): LogEntry {
  return {
    id: stringValue(record.id),
    logType: stringValue(record.logType),
    level: stringValue(record.level, stringValue(record.status, "info")),
    message: stringValue(record.message, stringValue(record.action)),
    traceId: nullableString(record.traceId ?? record.requestId),
    userId: nullableString(record.userId),
    ipAddress: nullableString(record.ipAddress),
    metadata: objectValue(record.metadata),
    occurredAt: stringValue(record.occurredAt, stringValue(record.createdAt)),
    createdAt: stringValue(record.createdAt, stringValue(record.occurredAt)),
  };
}

function toImportExportTask(value: unknown): ImportExportTask {
  const record =
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
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
    errorPreview: Array.isArray(record.errorPreview)
      ? record.errorPreview.filter(
          (item): item is Record<string, unknown> =>
            typeof item === "object" && item !== null && !Array.isArray(item),
        )
      : [],
    resultExpiresAt: nullableString(record.resultExpiresAt),
    createdAt: stringValue(record.createdAt),
    updatedAt: stringValue(record.updatedAt),
    createdBy: nullableString(record.createdBy),
  };
}
