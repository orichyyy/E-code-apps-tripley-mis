import type { DatabaseAdapterExecutor, FileStorageAdapter } from "@web-admin-base/adapters";

import { bool, now, p } from "./db-utils";
import { writeWorkerTaskLog } from "./task-log";

export const fileCleanupTaskCode = "base.files.cleanup";
export const importExportResultCleanupTaskCode = "base.import-export.result-cleanup";

export function createFileCleanupTaskHandler(
  executor: DatabaseAdapterExecutor,
  storage: FileStorageAdapter
) {
  return async (): Promise<void> => {
    const rows = await executor.all(
      `SELECT id, object_key FROM file_objects
       WHERE status = 'invalid' AND is_deleted = ${bool(executor, true)}
       ORDER BY id ASC LIMIT 100`
    );
    for (const row of rows) {
      await storage.delete(String(row.object_key));
    }
    await writeWorkerTaskLog(executor, {
      level: "info",
      message: "Invalid file cleanup completed",
      taskCode: fileCleanupTaskCode,
      metadata: { deletedObjects: rows.length, completedAt: now() }
    });
  };
}

export function createImportExportResultCleanupTaskHandler(
  executor: DatabaseAdapterExecutor,
  storage: FileStorageAdapter
) {
  return async (): Promise<void> => {
    const expired = await executor.all(
      `SELECT id, result_file_object_id, error_file_object_id
       FROM import_export_tasks
       WHERE result_expires_at IS NOT NULL AND result_expires_at < ${p(executor, 1)}
       ORDER BY id ASC LIMIT 100`,
      [now()]
    );
    const fileIds = uniqueIds(expired.flatMap((row) => [row.result_file_object_id, row.error_file_object_id]));
    const files = fileIds.length === 0 ? [] : await selectFiles(executor, fileIds);
    const deletedAt = now();

    await executor.transaction(async () => {
      for (const file of files) {
        await executor.run(
          `UPDATE file_objects
           SET status = 'invalid', is_deleted = ${bool(executor, true)}, deleted_at = ${p(executor, 1)}, updated_at = ${p(executor, 2)}
           WHERE id = ${p(executor, 3)}`,
          [deletedAt, deletedAt, file.id]
        );
      }
    });
    for (const file of files) {
      await storage.delete(file.objectKey);
    }

    await writeWorkerTaskLog(executor, {
      level: "info",
      message: "Import/export result cleanup completed",
      taskCode: importExportResultCleanupTaskCode,
      metadata: { expiredTasks: expired.length, invalidatedFiles: files.length, completedAt: deletedAt }
    });
  };
}

async function selectFiles(executor: DatabaseAdapterExecutor, ids: string[]): Promise<Array<{ id: string; objectKey: string }>> {
  const markers = ids.map((_, index) => p(executor, index + 1)).join(", ");
  const rows = await executor.all(`SELECT id, object_key FROM file_objects WHERE id IN (${markers})`, ids);
  return rows.map((row) => ({ id: String(row.id), objectKey: String(row.object_key) }));
}

function uniqueIds(values: unknown[]): string[] {
  return Array.from(
    new Set(
      values
        .filter((value) => value !== null && value !== undefined)
        .map((value) => String(value))
    )
  );
}
