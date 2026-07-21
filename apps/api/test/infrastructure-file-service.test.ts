import type { FileStorageAdapter } from "@web-admin-base/adapters";
import { describe, expect, it, vi } from "vitest";

import { InfrastructureFileService } from "../src/modules/infrastructure/infrastructure-file.service";

describe("InfrastructureFileService", () => {
  it("deletes the uploaded object when metadata persistence fails", async () => {
    const deleted: string[] = [];
    const service = createFailingService(createStorage(deleted));

    await expect(service.uploadFile(upload())).rejects.toThrow("metadata unavailable");

    expect(deleted).toHaveLength(1);
  });

  it("emits a structured event when upload compensation also fails", async () => {
    const errorSink = vi.fn();
    const storage = createStorage([]);
    storage.delete = async () => {
      throw new Error("object unavailable");
    };
    const service = createFailingService(storage, errorSink);

    await expect(service.uploadFile(upload())).rejects.toThrow("metadata unavailable");

    expect(errorSink).toHaveBeenCalledWith(
      expect.objectContaining({ event: "file.upload.compensation_failed" }),
    );
  });
});

function createFailingService(
  storage: FileStorageAdapter,
  errorSink?: ConstructorParameters<typeof InfrastructureFileService>[0]["errorSink"],
) {
  return new InfrastructureFileService({
    storage,
    maxFileSizeBytes: 1024,
    presignedUrlTtlSeconds: 60,
    nextId: () => "1",
    errorSink,
    repository: {
      listFiles: async () => [],
      getFile: async () => null,
      createFile: async () => {
        throw new Error("metadata unavailable");
      },
      deleteFile: async () => null,
      listFileReferences: async () => [],
    },
  });
}

function createStorage(deleted: string[]): FileStorageAdapter {
  return {
    storageDriver: "s3",
    healthCheck: async () => ({ ok: true }),
    put: async (objectKey, body, contentType) => ({
      storageDriver: "s3",
      storageBucket: "admin-files",
      objectKey,
      contentType,
      sizeBytes: body.byteLength,
    }),
    get: async () => null,
    delete: async (location) => {
      deleted.push(location.objectKey);
    },
    createDownloadUrl: async () => null,
  };
}

function upload() {
  return {
    originalName: "report.txt",
    contentType: "text/plain",
    body: new TextEncoder().encode("report"),
    actorId: "1",
  };
}
