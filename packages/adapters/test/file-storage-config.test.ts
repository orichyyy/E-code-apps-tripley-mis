import { describe, expect, it } from "vitest";

import { loadFileStorageConfig } from "../src";

describe("loadFileStorageConfig", () => {
  it("loads one shared normalized S3 contract for API and worker runtimes", () => {
    const config = loadFileStorageConfig({
      NODE_ENV: "test",
      FILE_STORAGE_DRIVER: "s3",
      FILE_STORAGE_ROOT: "./local-files",
      S3_ENDPOINT: "http://127.0.0.1:9000",
      S3_REGION: "us-east-1",
      S3_BUCKET: "admin-files",
      S3_OBJECT_PREFIX: "/tripley/dev//",
      S3_FORCE_PATH_STYLE: "true",
      S3_AUTO_CREATE_BUCKET: "true",
      S3_PRESIGNED_URL_TTL_SECONDS: "120",
      S3_ACCESS_KEY_ID: "test-access",
      S3_SECRET_ACCESS_KEY: "test-secret",
      S3_SESSION_TOKEN: "test-session",
    });

    expect(config).toEqual({
      activeDriver: "s3",
      local: { rootDirectory: "./local-files" },
      presignedUrlTtlSeconds: 120,
      s3: {
        endpoint: "http://127.0.0.1:9000",
        region: "us-east-1",
        bucket: "admin-files",
        objectPrefix: "tripley/dev/",
        forcePathStyle: true,
        autoCreateBucket: true,
        credentials: {
          accessKeyId: "test-access",
          secretAccessKey: "test-secret",
          sessionToken: "test-session",
        },
      },
    });
  });

  it("rejects incomplete or production-unsafe S3 configuration", () => {
    expect(() => loadFileStorageConfig({ NODE_ENV: "test", FILE_STORAGE_DRIVER: "s3" })).toThrow(
      /S3_REGION/,
    );
    expect(() =>
      loadFileStorageConfig({
        NODE_ENV: "test",
        FILE_STORAGE_DRIVER: "s3",
        S3_REGION: "us-east-1",
      }),
    ).toThrow(/S3_BUCKET/);
    expect(() =>
      loadFileStorageConfig({
        NODE_ENV: "test",
        FILE_STORAGE_DRIVER: "s3",
        S3_REGION: "us-east-1",
        S3_BUCKET: "admin-files",
        S3_ACCESS_KEY_ID: "access-only",
      }),
    ).toThrow(/S3_SECRET_ACCESS_KEY/);
    expect(() =>
      loadFileStorageConfig({
        NODE_ENV: "production",
        FILE_STORAGE_DRIVER: "s3",
        S3_REGION: "us-east-1",
        S3_BUCKET: "admin-files",
        S3_AUTO_CREATE_BUCKET: "true",
      }),
    ).toThrow(/S3_AUTO_CREATE_BUCKET/);
    expect(() => loadFileStorageConfig({ S3_PRESIGNED_URL_TTL_SECONDS: "14" })).toThrow();
    expect(() => loadFileStorageConfig({ S3_PRESIGNED_URL_TTL_SECONDS: "901" })).toThrow();
  });

  it("uses the AWS SDK default credential chain when explicit credentials are omitted", () => {
    const config = loadFileStorageConfig({
      NODE_ENV: "test",
      FILE_STORAGE_DRIVER: "s3",
      S3_REGION: "us-east-1",
      S3_BUCKET: "admin-files",
    });

    expect(config.s3?.credentials).toBeUndefined();
  });
});
