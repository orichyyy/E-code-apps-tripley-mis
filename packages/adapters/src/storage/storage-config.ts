import { z } from "zod";

import { createLocalFileStorageAdapter } from "./local-file-storage";
import { createRoutedFileStorageAdapter } from "./routed-file-storage";
import {
  createS3FileStorageAdapter,
  normalizeS3ObjectPrefix,
  type S3FileStorageOptions,
} from "./s3-file-storage";
import type { FileStorageAdapter, FileStorageDriver } from ".";

const booleanStringSchema = z
  .enum(["true", "false", "1", "0"])
  .transform((value) => value === "true" || value === "1");

const optionalStringSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : null),
  z.string().min(1).nullable().default(null),
);

const fileStorageEnvironmentSchema = z
  .object({
    nodeEnv: z.enum(["development", "test", "demo", "production"]).default("development"),
    activeDriver: z.enum(["local", "s3"]).default("local"),
    rootDirectory: z.string().min(1).default(".web-admin-storage"),
    endpoint: optionalStringSchema,
    region: optionalStringSchema,
    bucket: optionalStringSchema,
    objectPrefix: optionalStringSchema,
    forcePathStyle: booleanStringSchema.default("false"),
    autoCreateBucket: booleanStringSchema.default("false"),
    presignedUrlTtlSeconds: z.coerce.number().int().min(15).max(900).default(60),
    accessKeyId: optionalStringSchema,
    secretAccessKey: optionalStringSchema,
    sessionToken: optionalStringSchema,
  })
  .superRefine((values, context) => {
    const s3Configured =
      values.activeDriver === "s3" ||
      Boolean(
        values.endpoint ||
        values.region ||
        values.bucket ||
        values.objectPrefix ||
        values.forcePathStyle ||
        values.autoCreateBucket ||
        values.accessKeyId ||
        values.secretAccessKey ||
        values.sessionToken,
      );
    if (s3Configured && !values.region) {
      addConfigIssue(context, "region", "S3_REGION is required when S3 storage is configured.");
    }
    if (s3Configured && !values.bucket) {
      addConfigIssue(context, "bucket", "S3_BUCKET is required when S3 storage is configured.");
    }
    if (Boolean(values.accessKeyId) !== Boolean(values.secretAccessKey)) {
      const missing = values.accessKeyId ? "secretAccessKey" : "accessKeyId";
      const name = values.accessKeyId ? "S3_SECRET_ACCESS_KEY" : "S3_ACCESS_KEY_ID";
      addConfigIssue(context, missing, `${name} must be provided with the matching credential.`);
    }
    if (values.sessionToken && (!values.accessKeyId || !values.secretAccessKey)) {
      addConfigIssue(
        context,
        "sessionToken",
        "S3_SESSION_TOKEN requires S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.",
      );
    }
    if (values.nodeEnv === "production" && values.autoCreateBucket) {
      addConfigIssue(
        context,
        "autoCreateBucket",
        "S3_AUTO_CREATE_BUCKET cannot be enabled in production.",
      );
    }
  });

export type FileStorageConfig = {
  activeDriver: FileStorageDriver;
  local: { rootDirectory: string };
  presignedUrlTtlSeconds: number;
  s3: S3FileStorageOptions | null;
};

export function loadFileStorageConfig(env: NodeJS.ProcessEnv = process.env): FileStorageConfig {
  const values = fileStorageEnvironmentSchema.parse({
    nodeEnv: env.NODE_ENV,
    activeDriver: env.FILE_STORAGE_DRIVER,
    rootDirectory: env.FILE_STORAGE_ROOT,
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    bucket: env.S3_BUCKET,
    objectPrefix: env.S3_OBJECT_PREFIX,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    autoCreateBucket: env.S3_AUTO_CREATE_BUCKET,
    presignedUrlTtlSeconds: env.S3_PRESIGNED_URL_TTL_SECONDS,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    sessionToken: env.S3_SESSION_TOKEN,
  });
  const s3Configured =
    values.activeDriver === "s3" || Boolean(values.region || values.bucket || values.endpoint);

  return {
    activeDriver: values.activeDriver,
    local: { rootDirectory: values.rootDirectory },
    presignedUrlTtlSeconds: values.presignedUrlTtlSeconds,
    s3: s3Configured
      ? {
          endpoint: values.endpoint,
          region: values.region ?? "",
          bucket: values.bucket ?? "",
          objectPrefix: normalizeS3ObjectPrefix(values.objectPrefix),
          forcePathStyle: values.forcePathStyle,
          autoCreateBucket: values.autoCreateBucket,
          credentials:
            values.accessKeyId && values.secretAccessKey
              ? {
                  accessKeyId: values.accessKeyId,
                  secretAccessKey: values.secretAccessKey,
                  sessionToken: values.sessionToken,
                }
              : undefined,
        }
      : null,
  };
}

export async function createConfiguredFileStorageAdapter(
  config: FileStorageConfig,
): Promise<FileStorageAdapter> {
  const adapters: FileStorageAdapter[] = [createLocalFileStorageAdapter(config.local)];
  if (config.s3) adapters.push(await createS3FileStorageAdapter(config.s3));
  return createRoutedFileStorageAdapter({ activeDriver: config.activeDriver, adapters });
}

function addConfigIssue(context: z.RefinementCtx, path: string, message: string): void {
  context.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
}
