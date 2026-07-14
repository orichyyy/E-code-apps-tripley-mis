import type { FileDownloadUrlOptions, FileObjectLocation, FileStorageAdapter } from ".";
import { createAwsS3ObjectClient } from "./aws-s3-object-client";

export type S3ObjectInput = {
  bucket: string;
  objectKey: string;
};

export type S3PutObjectInput = S3ObjectInput & {
  body: Uint8Array;
  contentType: string;
};

export type S3PresignedGetInput = S3ObjectInput & FileDownloadUrlOptions;

export type S3ObjectClient = {
  headBucket: (bucket: string) => Promise<void>;
  createBucket: (bucket: string) => Promise<void>;
  putObject: (input: S3PutObjectInput) => Promise<void>;
  getObject: (input: S3ObjectInput) => Promise<Uint8Array | null>;
  deleteObject: (input: S3ObjectInput) => Promise<void>;
  createPresignedGetUrl: (input: S3PresignedGetInput) => Promise<string>;
};

export type S3FileStorageRuntimeOptions = {
  bucket: string;
  objectPrefix?: string | null;
  autoCreateBucket?: boolean;
};

export type S3FileStorageOptions = S3FileStorageRuntimeOptions & {
  region: string;
  endpoint?: string | null;
  forcePathStyle?: boolean;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string | null;
  };
};

export async function createS3FileStorageAdapter(
  options: S3FileStorageOptions,
): Promise<FileStorageAdapter> {
  const client = await createAwsS3ObjectClient(options);
  return createS3FileStorageAdapterFromClient(client, options);
}

export function createS3FileStorageAdapterFromClient(
  client: S3ObjectClient,
  options: S3FileStorageRuntimeOptions,
): FileStorageAdapter {
  const objectPrefix = normalizeS3ObjectPrefix(options.objectPrefix);

  return {
    storageDriver: "s3",
    async healthCheck() {
      try {
        try {
          await client.headBucket(options.bucket);
        } catch (error) {
          if (!options.autoCreateBucket || !isMissingBucketError(error)) throw error;
          await client.createBucket(options.bucket);
          await client.headBucket(options.bucket);
        }
        return { ok: true };
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : String(error) };
      }
    },
    async put(objectKey, body, contentType) {
      const completeObjectKey = `${objectPrefix}${normalizeObjectKey(objectKey)}`;
      await client.putObject({
        bucket: options.bucket,
        objectKey: completeObjectKey,
        body,
        contentType,
      });
      return {
        storageDriver: "s3",
        storageBucket: options.bucket,
        objectKey: completeObjectKey,
        contentType,
        sizeBytes: body.byteLength,
      };
    },
    get(location) {
      return client.getObject(toS3ObjectInput(location));
    },
    delete(location) {
      return client.deleteObject(toS3ObjectInput(location));
    },
    async createDownloadUrl(location, downloadOptions) {
      const url = await client.createPresignedGetUrl({
        ...toS3ObjectInput(location),
        ...downloadOptions,
      });
      return {
        url,
        expiresAt: new Date(Date.now() + downloadOptions.expiresInSeconds * 1000),
      };
    },
  };
}

function isMissingBucketError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const metadata = "$metadata" in error ? error.$metadata : null;
  if (metadata && typeof metadata === "object" && "httpStatusCode" in metadata) {
    return metadata.httpStatusCode === 404;
  }
  const name = "name" in error ? String(error.name) : "";
  return name === "NotFound" || name === "NoSuchBucket";
}

export function normalizeS3ObjectPrefix(prefix?: string | null): string {
  const normalized =
    prefix
      ?.trim()
      .replaceAll("\\", "/")
      .replace(/^\/+|\/+$/g, "") ?? "";
  return normalized ? `${normalized}/` : "";
}

function normalizeObjectKey(objectKey: string): string {
  const normalized = objectKey.replaceAll("\\", "/").replace(/^\/+/, "");
  if (!normalized || normalized.split("/").some((segment) => segment === "..")) {
    throw new Error("Object key must stay within the configured storage prefix.");
  }
  return normalized;
}

function toS3ObjectInput(location: FileObjectLocation): S3ObjectInput {
  if (location.storageDriver !== "s3") {
    throw new Error(`S3 file storage cannot access ${location.storageDriver} objects.`);
  }
  if (!location.storageBucket) {
    throw new Error("S3 object location requires a storage bucket.");
  }
  return {
    bucket: location.storageBucket,
    objectKey: location.objectKey,
  };
}
