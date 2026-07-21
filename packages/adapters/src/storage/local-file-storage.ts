import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import { randomUUID } from "node:crypto";

import type { FileStorageAdapter, StoredFileObject } from ".";

export type LocalFileStorageOptions = {
  rootDirectory: string;
};

export function createLocalFileStorageAdapter(
  options: LocalFileStorageOptions,
): FileStorageAdapter {
  const root = normalize(options.rootDirectory);

  return {
    storageDriver: "local",
    async healthCheck() {
      await mkdir(root, { recursive: true });
      return { ok: true };
    },
    async put(objectKey, body, contentType): Promise<StoredFileObject> {
      const target = resolveObjectPath(root, objectKey);
      await mkdir(dirname(target), { recursive: true });
      const temp = `${target}.${randomUUID()}.tmp`;
      await writeFile(temp, body);
      await rename(temp, target);
      return {
        storageDriver: "local",
        storageBucket: null,
        objectKey,
        contentType,
        sizeBytes: body.byteLength,
      };
    },
    async get(location) {
      assertLocalLocation(location.storageDriver);
      try {
        return await readFile(resolveObjectPath(root, location.objectKey));
      } catch (error) {
        if (isNodeError(error) && error.code === "ENOENT") return null;
        throw error;
      }
    },
    async delete(location) {
      assertLocalLocation(location.storageDriver);
      await rm(resolveObjectPath(root, location.objectKey), { force: true });
    },
    async createDownloadUrl() {
      return null;
    },
  };
}

function assertLocalLocation(storageDriver: string): void {
  if (storageDriver !== "local") {
    throw new Error(`Local file storage cannot access ${storageDriver} objects.`);
  }
}

function resolveObjectPath(root: string, objectKey: string): string {
  const resolved = normalize(join(root, objectKey));
  if (resolved !== root && !resolved.startsWith(`${root}\\`) && !resolved.startsWith(`${root}/`)) {
    throw new Error("Object key resolves outside the storage root.");
  }
  return resolved;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
