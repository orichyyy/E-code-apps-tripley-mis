import { describe, expect, it } from "vitest";

import {
  createRoutedFileStorageAdapter,
  type FileObjectLocation,
  type FileStorageAdapter,
} from "../src";

describe("createRoutedFileStorageAdapter", () => {
  it("writes through the active driver and reads historical objects through their recorded driver", async () => {
    const local = createMemoryStorage("local");
    const s3 = createMemoryStorage("s3", "files");
    const storage = createRoutedFileStorageAdapter({
      activeDriver: "s3",
      adapters: [local, s3],
    });

    const uploaded = await storage.put(
      "uploads/2026/07/report.txt",
      new TextEncoder().encode("new s3 file"),
      "text/plain",
    );
    const historicalLocal: FileObjectLocation = {
      storageDriver: "local",
      storageBucket: null,
      objectKey: "uploads/2026/06/legacy.txt",
    };
    await local.put(historicalLocal.objectKey, new TextEncoder().encode("legacy"), "text/plain");

    expect(uploaded).toEqual(
      expect.objectContaining({ storageDriver: "s3", storageBucket: "files" }),
    );
    await expect(storage.get(uploaded)).resolves.toEqual(new TextEncoder().encode("new s3 file"));
    await expect(storage.get(historicalLocal)).resolves.toEqual(new TextEncoder().encode("legacy"));
  });
});

function createMemoryStorage(
  storageDriver: "local" | "s3",
  storageBucket: string | null = null,
): FileStorageAdapter {
  const objects = new Map<string, Uint8Array>();
  return {
    storageDriver,
    async healthCheck() {
      return { ok: true };
    },
    async put(objectKey, body, contentType) {
      objects.set(objectKey, body.slice());
      return {
        storageDriver,
        storageBucket,
        objectKey,
        contentType,
        sizeBytes: body.byteLength,
      };
    },
    async get(location) {
      return objects.get(location.objectKey)?.slice() ?? null;
    },
    async delete(location) {
      objects.delete(location.objectKey);
    },
    async createDownloadUrl() {
      return null;
    },
  };
}
