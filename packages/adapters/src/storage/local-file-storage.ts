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
        objectKey,
        contentType,
        sizeBytes: body.byteLength,
      };
    },
    async get(objectKey) {
      try {
        return await readFile(resolveObjectPath(root, objectKey));
      } catch (error) {
        if (isNodeError(error) && error.code === "ENOENT") return null;
        throw error;
      }
    },
    async delete(objectKey) {
      await rm(resolveObjectPath(root, objectKey), { force: true });
    },
  };
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
