import { randomUUID } from "node:crypto";

import type {
  DatabaseAdapterExecutor,
  FileStorageAdapter,
  StoredFileObject,
} from "@web-admin-base/adapters";
import { parse } from "csv-parse/sync";

import { bool, now, p } from "../tasks/db-utils";

export async function readManagedCsv(
  executor: DatabaseAdapterExecutor,
  storage: FileStorageAdapter,
  fileId: string,
): Promise<Array<Record<string, string>>> {
  const rows = await executor.all(
    `SELECT object_key, storage_bucket, storage_driver, status, is_deleted
     FROM file_objects WHERE id = ${p(executor, 1)} LIMIT 1`,
    [fileId],
  );
  const file = rows[0];
  if (!file || file.status !== "active" || Boolean(file.is_deleted)) {
    throw new Error("CSV source file is not active.");
  }
  const body = await storage.get({
    objectKey: String(file.object_key),
    storageBucket: file.storage_bucket ? String(file.storage_bucket) : null,
    storageDriver: String(file.storage_driver) as "local" | "s3",
  });
  if (!body) throw new Error("CSV source content was not found.");
  return parse(new TextDecoder().decode(body), {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Array<Record<string, string>>;
}

export async function persistCsvResult(
  executor: DatabaseAdapterExecutor,
  storage: FileStorageAdapter,
  input: {
    taskId: string;
    moduleCode: string;
    csv: string;
    suffix: string;
    createdBy: string | null;
  },
): Promise<string> {
  const objectKey = `exports/modules/${input.moduleCode}/${input.taskId}-${input.suffix}-${randomUUID()}.csv`;
  const stored = await storage.put(objectKey, new TextEncoder().encode(input.csv), "text/csv");
  try {
    return await insertResultFile(executor, stored, input.createdBy);
  } catch (error) {
    await storage.delete(stored).catch(() => undefined);
    throw error;
  }
}

async function insertResultFile(
  executor: DatabaseAdapterExecutor,
  stored: StoredFileObject,
  createdBy: string | null,
): Promise<string> {
  const timestamp = now();
  await executor.run(
    `INSERT INTO file_objects
      (object_key, storage_bucket, original_name, content_type, extension, size_bytes,
       storage_driver, status, referenced, is_deleted, created_at, updated_at, created_by, updated_by)
     VALUES (${p(executor, 1)}, ${p(executor, 2)}, ${p(executor, 3)}, 'text/csv', 'csv',
      ${p(executor, 4)}, ${p(executor, 5)}, 'active', ${bool(executor, false)},
      ${bool(executor, false)}, ${p(executor, 6)}, ${p(executor, 7)}, ${p(executor, 8)},
      ${p(executor, 9)})`,
    [
      stored.objectKey,
      stored.storageBucket,
      stored.objectKey.split("/").at(-1) ?? "result.csv",
      stored.sizeBytes,
      stored.storageDriver,
      timestamp,
      timestamp,
      createdBy,
      createdBy,
    ],
  );
  const rows = await executor.all(
    `SELECT id FROM file_objects WHERE object_key = ${p(executor, 1)} LIMIT 1`,
    [stored.objectKey],
  );
  if (!rows[0]) throw new Error("CSV result metadata was not persisted.");
  return String(rows[0].id);
}
