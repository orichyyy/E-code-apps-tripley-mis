import { describe, expect, it } from "vitest";

import { createS3FileStorageAdapterFromClient, type S3ObjectClient } from "../src";

describe("createS3FileStorageAdapterFromClient", () => {
  it("persists the configured bucket and complete prefixed object key", async () => {
    const client = createMemoryS3Client();
    const storage = createS3FileStorageAdapterFromClient(client, {
      bucket: "admin-files",
      objectPrefix: "/tripley/dev//",
    });
    const body = new TextEncoder().encode("s3 content");

    const stored = await storage.put("uploads/2026/07/report.txt", body, "text/plain");
    const read = await storage.get(stored);

    expect(stored).toEqual({
      storageDriver: "s3",
      storageBucket: "admin-files",
      objectKey: "tripley/dev/uploads/2026/07/report.txt",
      contentType: "text/plain",
      sizeBytes: body.byteLength,
    });
    expect(read).toEqual(body);
  });

  it("creates a missing bucket only when automatic creation is explicitly enabled", async () => {
    const client = createMemoryS3Client({ bucketExists: false });
    const storage = createS3FileStorageAdapterFromClient(client, {
      bucket: "admin-files",
      autoCreateBucket: true,
    });

    await expect(storage.healthCheck()).resolves.toEqual({ ok: true });
    expect(client.createdBuckets).toEqual(["admin-files"]);
  });

  it("reports a missing bucket without creating it by default", async () => {
    const client = createMemoryS3Client({ bucketExists: false });
    const storage = createS3FileStorageAdapterFromClient(client, { bucket: "admin-files" });

    await expect(storage.healthCheck()).resolves.toEqual({
      ok: false,
      message: "Bucket does not exist",
    });
    expect(client.createdBuckets).toEqual([]);
  });
});

function createMemoryS3Client(options: { bucketExists?: boolean } = {}): S3ObjectClient & {
  createdBuckets: string[];
} {
  const objects = new Map<string, Uint8Array>();
  let bucketExists = options.bucketExists ?? true;
  const createdBuckets: string[] = [];
  return {
    createdBuckets,
    async headBucket() {
      if (!bucketExists) {
        throw Object.assign(new Error("Bucket does not exist"), {
          $metadata: { httpStatusCode: 404 },
        });
      }
    },
    async createBucket(bucket) {
      createdBuckets.push(bucket);
      bucketExists = true;
    },
    async putObject(input) {
      objects.set(`${input.bucket}/${input.objectKey}`, input.body.slice());
    },
    async getObject(input) {
      return objects.get(`${input.bucket}/${input.objectKey}`)?.slice() ?? null;
    },
    async deleteObject(input) {
      objects.delete(`${input.bucket}/${input.objectKey}`);
    },
    async createPresignedGetUrl() {
      return "https://storage.example.test/signed";
    },
  };
}
