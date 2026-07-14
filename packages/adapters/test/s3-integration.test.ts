import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createConfiguredFileStorageAdapter, loadFileStorageConfig } from "../src/storage";

const required = process.env.S3_INTEGRATION_REQUIRED === "true";
const endpoint = process.env.S3_ENDPOINT;

if (required && !endpoint) {
  throw new Error("S3_ENDPOINT is required for the S3 compatibility test.");
}

describe.runIf(required)("S3-compatible storage integration", () => {
  it("auto-creates a private test bucket and supports the complete object lifecycle", async () => {
    const bucket = `web-admin-base-${randomUUID()}`;
    const storage = await createConfiguredFileStorageAdapter(
      loadFileStorageConfig({
        NODE_ENV: "test",
        FILE_STORAGE_DRIVER: "s3",
        FILE_STORAGE_ROOT: ".web-admin-storage-s3-test",
        S3_ENDPOINT: endpoint,
        S3_REGION: process.env.S3_REGION ?? "us-east-1",
        S3_BUCKET: bucket,
        S3_OBJECT_PREFIX: "/compatibility/run/",
        S3_FORCE_PATH_STYLE: "true",
        S3_AUTO_CREATE_BUCKET: "true",
        S3_PRESIGNED_URL_TTL_SECONDS: "60",
        S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
        S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
        S3_SESSION_TOKEN: process.env.S3_SESSION_TOKEN,
      }),
    );

    await expect(storage.healthCheck()).resolves.toEqual({ ok: true });
    const body = new TextEncoder().encode("rustfs compatibility");
    const stored = await storage.put("documents/result.txt", body, "text/plain");

    expect(stored).toEqual(
      expect.objectContaining({
        storageDriver: "s3",
        storageBucket: bucket,
        objectKey: "compatibility/run/documents/result.txt",
      }),
    );
    await expect(storage.get(stored)).resolves.toEqual(body);

    const signed = await storage.createDownloadUrl(stored, {
      contentType: "text/plain",
      filename: "result.txt",
      disposition: "attachment",
      expiresInSeconds: 60,
    });
    expect(signed).not.toBeNull();
    expect(new URL(signed?.url ?? "").searchParams.get("X-Amz-Expires")).toBe("60");
    const response = await fetch(signed?.url ?? "");
    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("rustfs compatibility");

    await storage.delete(stored);
    await expect(storage.get(stored)).resolves.toBeNull();
  });
});
