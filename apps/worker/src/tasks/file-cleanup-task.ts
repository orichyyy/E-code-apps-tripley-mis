import type {
  DatabaseAdapterExecutor,
  FileObjectLocation,
  FileStorageAdapter,
} from "@web-admin-base/adapters";

import { bool, now, p } from "./db-utils";
import { writeWorkerTaskLog } from "./task-log";

export const fileCleanupTaskCode = "base.files.cleanup";
export const importExportResultCleanupTaskCode = "base.import-export.result-cleanup";

export function createFileCleanupTaskHandler(
  executor: DatabaseAdapterExecutor,
  storage: FileStorageAdapter,
) {
  return async (): Promise<void> => {
    const rows = await executor.all(
      `SELECT id, storage_driver, storage_bucket, object_key FROM file_objects
       WHERE status = 'invalid' AND is_deleted = ${bool(executor, true)}
         AND content_deleted_at IS NULL
       ORDER BY id ASC LIMIT 100`,
    );
    const result = await deleteFileContents(executor, storage, rows.map(toStoredFile));
    await writeWorkerTaskLog(executor, {
      level: "info",
      message: "Invalid file cleanup completed",
      taskCode: fileCleanupTaskCode,
      metadata: { ...result, completedAt: now() },
    });
  };
}

export function createImportExportResultCleanupTaskHandler(
  executor: DatabaseAdapterExecutor,
  storage: FileStorageAdapter,
) {
  return async (): Promise<void> => {
    const expired = await executor.all(
      `SELECT id, result_file_object_id, error_file_object_id
       FROM import_export_tasks
       WHERE result_expires_at IS NOT NULL AND result_expires_at < ${p(executor, 1)}
       ORDER BY id ASC LIMIT 100`,
      [now()],
    );
    const fileIds = uniqueIds(
      expired.flatMap((row) => [row.result_file_object_id, row.error_file_object_id]),
    );
    const files = fileIds.length === 0 ? [] : await selectFiles(executor, fileIds);
    const deletedAt = now();

    await executor.transaction(async () => {
      for (const file of files) {
        await executor.run(
          `UPDATE file_objects
           SET status = 'invalid', is_deleted = ${bool(executor, true)}, deleted_at = ${p(executor, 1)}, updated_at = ${p(executor, 2)}
           WHERE id = ${p(executor, 3)}`,
          [deletedAt, deletedAt, file.id],
        );
      }
    });
    const deletion = await deleteFileContents(executor, storage, files);

    await writeWorkerTaskLog(executor, {
      level: "info",
      message: "Import/export result cleanup completed",
      taskCode: importExportResultCleanupTaskCode,
      metadata: {
        expiredTasks: expired.length,
        invalidatedFiles: files.length,
        ...deletion,
        completedAt: deletedAt,
      },
    });
  };
}

async function selectFiles(
  executor: DatabaseAdapterExecutor,
  ids: string[],
): Promise<StoredFile[]> {
  const markers = ids.map((_, index) => p(executor, index + 1)).join(", ");
  const rows = await executor.all(
    `SELECT id, storage_driver, storage_bucket, object_key FROM file_objects WHERE id IN (${markers})`,
    ids,
  );
  return rows.map(toStoredFile);
}

type StoredFile = FileObjectLocation & { id: string };

async function deleteFileContents(
  executor: DatabaseAdapterExecutor,
  storage: FileStorageAdapter,
  files: StoredFile[],
): Promise<{ deletedObjects: number; failedObjects: number }> {
  let deletedObjects = 0;
  let failedObjects = 0;
  for (const file of files) {
    try {
      await storage.delete(file);
      const deletedAt = now();
      await executor.run(
        `UPDATE file_objects SET content_deleted_at = ${p(executor, 1)}, updated_at = ${p(executor, 2)} WHERE id = ${p(executor, 3)}`,
        [deletedAt, deletedAt, file.id],
      );
      deletedObjects += 1;
    } catch (error) {
      failedObjects += 1;
      await writeWorkerTaskLog(executor, {
        level: "error",
        message: "File content deletion failed and will be retried",
        taskCode: fileCleanupTaskCode,
        metadata: { fileId: file.id, storageDriver: file.storageDriver, error: toMessage(error) },
      });
    }
  }
  return { deletedObjects, failedObjects };
}

function toStoredFile(row: Record<string, unknown>): StoredFile {
  const storageDriver = String(row.storage_driver);
  if (storageDriver !== "local" && storageDriver !== "s3") {
    throw new Error(`Unsupported file storage driver: ${storageDriver}.`);
  }
  return {
    id: String(row.id),
    storageDriver,
    storageBucket: row.storage_bucket == null ? null : String(row.storage_bucket),
    objectKey: String(row.object_key),
  };
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function uniqueIds(values: unknown[]): string[] {
  return Array.from(
    new Set(
      values.filter((value) => value !== null && value !== undefined).map((value) => String(value)),
    ),
  );
}
