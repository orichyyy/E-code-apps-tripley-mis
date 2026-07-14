import type { S3FileStorageOptions, S3ObjectClient } from "./s3-file-storage";

type S3Module = typeof import("@aws-sdk/client-s3");
type PresignerModule = typeof import("@aws-sdk/s3-request-presigner");

export async function createAwsS3ObjectClient(
  options: S3FileStorageOptions,
): Promise<S3ObjectClient> {
  const [s3, presigner] = await Promise.all([
    import("@aws-sdk/client-s3") as Promise<S3Module>,
    import("@aws-sdk/s3-request-presigner") as Promise<PresignerModule>,
  ]);
  const client = new s3.S3Client({
    region: options.region,
    endpoint: options.endpoint ?? undefined,
    forcePathStyle: options.forcePathStyle ?? false,
    credentials: toAwsCredentials(options.credentials),
  });

  return {
    async headBucket(bucket) {
      await client.send(new s3.HeadBucketCommand({ Bucket: bucket }));
    },
    async createBucket(bucket) {
      await client.send(new s3.CreateBucketCommand({ Bucket: bucket }));
    },
    async putObject(input) {
      await client.send(
        new s3.PutObjectCommand({
          Bucket: input.bucket,
          Key: input.objectKey,
          Body: input.body,
          ContentType: input.contentType,
        }),
      );
    },
    async getObject(input) {
      try {
        const output = await client.send(
          new s3.GetObjectCommand({ Bucket: input.bucket, Key: input.objectKey }),
        );
        return output.Body ? await output.Body.transformToByteArray() : new Uint8Array();
      } catch (error) {
        if (isMissingObjectError(error)) return null;
        throw error;
      }
    },
    async deleteObject(input) {
      await client.send(new s3.DeleteObjectCommand({ Bucket: input.bucket, Key: input.objectKey }));
    },
    async createPresignedGetUrl(input) {
      return presigner.getSignedUrl(
        client,
        new s3.GetObjectCommand({
          Bucket: input.bucket,
          Key: input.objectKey,
          ResponseContentType: input.contentType,
          ResponseContentDisposition: contentDisposition(input.filename, input.disposition),
        }),
        { expiresIn: input.expiresInSeconds },
      );
    },
  };
}

function toAwsCredentials(credentials: S3FileStorageOptions["credentials"]) {
  if (!credentials) return undefined;
  return {
    accessKeyId: credentials.accessKeyId,
    secretAccessKey: credentials.secretAccessKey,
    sessionToken: credentials.sessionToken ?? undefined,
  };
}

function isMissingObjectError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  if (name === "NoSuchKey" || name === "NotFound") return true;
  const metadata = "$metadata" in error ? error.$metadata : null;
  return Boolean(
    metadata &&
    typeof metadata === "object" &&
    "httpStatusCode" in metadata &&
    metadata.httpStatusCode === 404,
  );
}

function contentDisposition(filename: string, disposition: "attachment" | "inline"): string {
  const fallback = filename.replace(/[^\w.-]/g, "_");
  const encoded = encodeURIComponent(filename).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${disposition}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
