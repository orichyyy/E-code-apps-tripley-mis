import {
  createLocalFileStorageAdapter,
  type DatabaseAdapterExecutor,
} from "@web-admin-base/adapters";

export async function clearWorkerTables(executor: DatabaseAdapterExecutor): Promise<void> {
  for (const table of [
    "file_references",
    "import_export_tasks",
    "file_objects",
    "notifications",
    "queue_jobs",
    "scheduled_jobs",
    "log_entries",
  ]) {
    await executor.run(`DELETE FROM ${table}`);
  }
}

export async function seedLogExport(executor: DatabaseAdapterExecutor): Promise<void> {
  const now = new Date().toISOString();
  await executor.run(
    "INSERT INTO log_entries (log_type, level, message, metadata_json, occurred_at, created_at) VALUES ('access', 'info', 'access exported', ?, ?, ?)",
    [JSON.stringify({ path: "/api/health" }), now, now],
  );
  await executor.run(
    "INSERT INTO import_export_tasks (task_type, resource_type, status, error_preview_json, result_expires_at, created_at, updated_at, created_by) VALUES ('export', 'logs:access', 'pending', ?, ?, ?, ? , '1')",
    [JSON.stringify([]), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), now, now],
  );
}

export async function seedOldLog(executor: DatabaseAdapterExecutor): Promise<void> {
  const old = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000).toISOString();
  await executor.run(
    "INSERT INTO log_entries (log_type, level, message, metadata_json, occurred_at, created_at) VALUES ('access', 'info', 'old access log', ?, ?, ?)",
    [JSON.stringify({}), old, old],
  );
}

export async function seedInvalidFile(
  executor: DatabaseAdapterExecutor,
  storage: ReturnType<typeof createLocalFileStorageAdapter>,
): Promise<void> {
  const now = new Date().toISOString();
  await storage.put("uploads/invalid.txt", new TextEncoder().encode("invalid"), "text/plain");
  await executor.run(
    "INSERT INTO file_objects (object_key, original_name, content_type, extension, size_bytes, storage_driver, status, referenced, is_deleted, deleted_at, created_at, updated_at) VALUES ('uploads/invalid.txt', 'invalid.txt', 'text/plain', 'txt', 7, 'local', 'invalid', 0, 1, ?, ?, ?)",
    [now, now, now],
  );
}

export async function seedExpiredExportResult(
  executor: DatabaseAdapterExecutor,
  storage: ReturnType<typeof createLocalFileStorageAdapter>,
): Promise<string> {
  const now = new Date().toISOString();
  const expired = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await storage.put("exports/expired.csv", new TextEncoder().encode("expired"), "text/csv");
  await executor.run(
    "INSERT INTO file_objects (object_key, original_name, content_type, extension, size_bytes, storage_driver, status, referenced, is_deleted, created_at, updated_at) VALUES ('exports/expired.csv', 'expired.csv', 'text/csv', 'csv', 7, 'local', 'active', 0, 0, ?, ?)",
    [now, now],
  );
  const fileRows = await executor.all(
    "SELECT id FROM file_objects WHERE object_key = 'exports/expired.csv'",
  );
  const fileId = String(fileRows[0]?.id);
  await executor.run(
    "INSERT INTO import_export_tasks (task_type, resource_type, status, result_file_object_id, error_preview_json, result_expires_at, created_at, updated_at, created_by) VALUES ('export', 'logs:access', 'succeeded', ?, ?, ?, ?, ?, '1')",
    [fileId, JSON.stringify([]), expired, now, now],
  );
  return fileId;
}

export async function scheduledTaskId(
  executor: DatabaseAdapterExecutor,
  code: string,
): Promise<string> {
  const rows = await executor.all("SELECT id FROM scheduled_jobs WHERE code = ? LIMIT 1", [code]);
  if (!rows[0]) throw new Error(`Scheduled task was not registered: ${code}`);
  return String(rows[0].id);
}

export function localLocation(objectKey: string) {
  return { storageDriver: "local" as const, storageBucket: null, objectKey };
}
