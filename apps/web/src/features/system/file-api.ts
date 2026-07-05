import { requestJson, stringField, unwrapRecords } from "@/lib/api-request";
import { internalApiClient } from "@/lib/api-request";

export type FileRecord = {
  id: string;
  objectKey: string;
  originalName: string;
  contentType: string;
  extension: string;
  sizeBytes: number;
  storageDriver: string;
  status: string;
  referenced: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
};

export type FileReference = {
  id: string;
  fileObjectId: string;
  resourceType: string;
  resourceId: string;
  referenceType: string;
  status: string;
  createdAt: string;
  createdBy: string | null;
};

export async function fetchFiles(): Promise<FileRecord[]> {
  const envelope = await requestJson<{ data?: unknown }>("/files");
  return unwrapRecords(envelope.data).map(toFileRecord);
}

export async function fetchFileDetail(id: string): Promise<FileRecord | null> {
  const envelope = await requestJson<{ data?: unknown }>(`/files/${id}`);
  return isRecord(envelope.data) ? toFileRecord(envelope.data) : null;
}

export async function deleteFile(id: string) {
  return requestJson<{ data: FileRecord | null }>(`/files/${id}`, {
    method: "DELETE",
  });
}

export async function uploadFile(file: File): Promise<FileRecord | null> {
  const formData = new FormData();
  formData.set("file", file);
  const envelope = await requestMultipart<{ data?: unknown }>("/files/upload", formData);
  return isRecord(envelope.data) ? toFileRecord(envelope.data) : null;
}

export async function fetchFileReferences(id: string): Promise<FileReference[]> {
  const envelope = await requestJson<{ data?: unknown }>(`/files/${id}/references`);
  return unwrapRecords(envelope.data).map(toFileReference);
}

export async function downloadFileBlob(id: string): Promise<Blob> {
  return requestBlob(`/files/${id}/download`);
}

export async function previewFileBlob(id: string): Promise<Blob> {
  return requestBlob(`/files/${id}/preview`);
}

function toFileRecord(record: Record<string, unknown>): FileRecord {
  return {
    id: stringField(record.id, ""),
    objectKey: stringField(record.objectKey, ""),
    originalName: stringField(record.originalName, ""),
    contentType: stringField(record.contentType, ""),
    extension: stringField(record.extension, ""),
    sizeBytes: numberField(record.sizeBytes),
    storageDriver: stringField(record.storageDriver, ""),
    status: stringField(record.status, "active"),
    referenced: booleanField(record.referenced),
    isDeleted: booleanField(record.isDeleted),
    createdAt: stringField(record.createdAt, ""),
    updatedAt: stringField(record.updatedAt, ""),
  };
}

function toFileReference(record: Record<string, unknown>): FileReference {
  return {
    id: stringField(record.id, ""),
    fileObjectId: stringField(record.fileObjectId, ""),
    resourceType: stringField(record.resourceType, ""),
    resourceId: stringField(record.resourceId, ""),
    referenceType: stringField(record.referenceType, ""),
    status: stringField(record.status, "active"),
    createdAt: stringField(record.createdAt, ""),
    createdBy: typeof record.createdBy === "string" ? record.createdBy : null,
  };
}

function numberField(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function booleanField(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return value === "true" || value === "1";
  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function requestMultipart<T>(endpoint: string, body: FormData): Promise<T> {
  const response = await fetch(`${internalApiClient.basePath}${endpoint}`, {
    method: "POST",
    body,
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
  return (await response.json()) as T;
}

async function requestBlob(endpoint: string): Promise<Blob> {
  const response = await fetch(`${internalApiClient.basePath}${endpoint}`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
  return response.blob();
}

function authHeaders(): HeadersInit {
  const token =
    typeof localStorage === "undefined" ? null : localStorage.getItem("web-admin.access-token");
  return token ? { authorization: `Bearer ${token}` } : {};
}
