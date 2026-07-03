import { requestJson, stringField, unwrapRecords } from "@/lib/api-request";

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
    method: "DELETE"
  });
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
    updatedAt: stringField(record.updatedAt, "")
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
