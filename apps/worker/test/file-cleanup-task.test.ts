import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { FileStorageAdapter } from "@web-admin-base/adapters";
import { runSqliteMigrations } from "@web-admin-base/db";
import { describe, expect, it } from "vitest";

import { createWorkerDatabaseExecutor } from "../src/infra/worker-database-executor";
import { createFileCleanupTaskHandler } from "../src/tasks/file-cleanup-task";
import { clearWorkerTables } from "./worker-test-helpers";

describe("file cleanup task", () => {
  it("continues after a failure and retries unfinished content later", async () => {
    const filename = join(tmpdir(), `web-admin-worker-retry-${process.pid}-${Date.now()}.sqlite`);
    const url = `file:${filename}`;
    runSqliteMigrations({ url });
    const executor = createWorkerDatabaseExecutor({ dialect: "sqlite", url });
    let failFirstObject = true;
    const deleted: string[] = [];
    const storage = createFailingStorage(deleted, () => failFirstObject);

    try {
      await clearWorkerTables(executor);
      await seedInvalidS3File(executor, "failed.txt");
      await seedInvalidS3File(executor, "succeeded.txt");
      const cleanup = createFileCleanupTaskHandler(executor, storage);

      await cleanup();
      let rows = await executor.all(
        "SELECT object_key, content_deleted_at FROM file_objects ORDER BY id ASC",
      );
      expect(rows[0]?.content_deleted_at).toBeNull();
      expect(rows[1]?.content_deleted_at).toBeTruthy();
      expect(deleted).toEqual(["succeeded.txt"]);

      failFirstObject = false;
      await cleanup();
      rows = await executor.all(
        "SELECT object_key, content_deleted_at FROM file_objects ORDER BY id ASC",
      );
      expect(rows.every((row) => Boolean(row.content_deleted_at))).toBe(true);
      expect(deleted).toEqual(["succeeded.txt", "failed.txt"]);
    } finally {
      await clearWorkerTables(executor);
      await executor.close();
      if (existsSync(filename)) rmSync(filename, { force: true });
    }
  });
});

function createFailingStorage(deleted: string[], shouldFail: () => boolean): FileStorageAdapter {
  return {
    storageDriver: "s3",
    healthCheck: async () => ({ ok: true }),
    put: async () => {
      throw new Error("not used");
    },
    get: async () => null,
    createDownloadUrl: async () => null,
    delete: async (location) => {
      if (location.objectKey === "failed.txt" && shouldFail()) {
        throw new Error("temporary storage failure");
      }
      deleted.push(location.objectKey);
    },
  };
}

async function seedInvalidS3File(
  executor: ReturnType<typeof createWorkerDatabaseExecutor>,
  objectKey: string,
): Promise<void> {
  const timestamp = new Date().toISOString();
  await executor.run(
    "INSERT INTO file_objects (object_key, storage_bucket, original_name, content_type, extension, size_bytes, storage_driver, status, referenced, is_deleted, deleted_at, created_at, updated_at) VALUES (?, 'admin-files', ?, 'text/plain', 'txt', 1, 's3', 'invalid', 0, 1, ?, ?, ?)",
    [objectKey, objectKey, timestamp, timestamp, timestamp],
  );
}
