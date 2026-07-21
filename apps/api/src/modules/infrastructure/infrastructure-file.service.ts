import type { FileObjectLocation, FileStorageAdapter } from "@web-admin-base/adapters";

import { createKnownError } from "../../core/errors/error-codes";
import {
  createObjectKey,
  isPreviewableImage,
  validateUploadInput,
  type FileUploadInput,
  type ManagedFileRecord,
  type ManagedFileReferenceRecord,
  type StoredFileMetadataInput,
} from "./file-management";

type FileMetadataRepository = {
  listFiles: () => Promise<ManagedFileRecord[]>;
  getFile: (id: string) => Promise<ManagedFileRecord | null>;
  createFile: (input: StoredFileMetadataInput) => Promise<ManagedFileRecord | null>;
  deleteFile: (id: string, actorId: string | null) => Promise<ManagedFileRecord | null>;
  listFileReferences: (id: string) => Promise<ManagedFileReferenceRecord[]>;
};

export type FileStorageErrorEvent = {
  event: "file.upload.compensation_failed";
  location: FileObjectLocation;
  message: string;
};

export type InfrastructureFileServiceOptions = {
  repository?: FileMetadataRepository;
  storage: FileStorageAdapter;
  maxFileSizeBytes: number;
  presignedUrlTtlSeconds: number;
  nextId: () => string;
  errorSink?: (event: FileStorageErrorEvent) => void;
};

export class InfrastructureFileService {
  private readonly files: ManagedFileRecord[] = [];

  constructor(private readonly options: InfrastructureFileServiceOptions) {}

  listFiles() {
    return this.options.repository?.listFiles() ?? Promise.resolve(this.files);
  }

  getFile(id: string) {
    return (
      this.options.repository?.getFile(id) ??
      Promise.resolve(this.files.find((file) => file.id === id) ?? null)
    );
  }

  async uploadFile(input: FileUploadInput) {
    const normalized = validateUploadInput(input, this.options.maxFileSizeBytes);
    const stored = await this.options.storage.put(
      createObjectKey(normalized.extension),
      input.body,
      normalized.contentType,
    );
    const metadata: StoredFileMetadataInput = {
      storageDriver: stored.storageDriver,
      storageBucket: stored.storageBucket,
      objectKey: stored.objectKey,
      originalName: normalized.originalName,
      contentType: stored.contentType,
      extension: normalized.extension,
      sizeBytes: stored.sizeBytes,
      actorId: input.actorId,
    };

    if (this.options.repository) {
      try {
        const file = await this.options.repository.createFile(metadata);
        if (!file) throw createKnownError("SYSTEM_INTERNAL_ERROR");
        return file;
      } catch (error) {
        await this.compensateUpload(stored, error);
        throw error;
      }
    }

    const now = new Date().toISOString();
    const file: ManagedFileRecord = {
      id: this.options.nextId(),
      storageDriver: stored.storageDriver,
      storageBucket: stored.storageBucket,
      objectKey: stored.objectKey,
      originalName: normalized.originalName,
      contentType: stored.contentType,
      extension: normalized.extension,
      sizeBytes: stored.sizeBytes,
      status: "active",
      referenced: false,
      isDeleted: false,
      contentDeletedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.files.unshift(file);
    return file;
  }

  async getFileContent(id: string, mode: "download" | "preview") {
    const file = await this.requireActiveFile(id);
    if (mode === "preview" && !isPreviewableImage(file.contentType)) {
      throw createKnownError("FILE_PREVIEW_NOT_SUPPORTED");
    }
    const downloadUrl = await this.options.storage.createDownloadUrl(file, {
      contentType: file.contentType,
      filename: file.originalName,
      disposition: mode === "download" ? "attachment" : "inline",
      expiresInSeconds: this.options.presignedUrlTtlSeconds,
    });
    if (downloadUrl) return { kind: "redirect" as const, file, ...downloadUrl };

    const body = await this.options.storage.get(file);
    if (!body) throw createKnownError("FILE_NOT_FOUND");
    return { kind: "content" as const, file, body };
  }

  async deleteFile(id: string, actorId: string | null) {
    if (this.options.repository) return this.options.repository.deleteFile(id, actorId);
    const file = this.files.find((item) => item.id === id);
    if (!file) return null;
    const deletedAt = new Date().toISOString();
    Object.assign(file, {
      status: "invalid",
      isDeleted: true,
      updatedAt: deletedAt,
    });
    return file;
  }

  listFileReferences(id: string) {
    return this.options.repository?.listFileReferences(id) ?? Promise.resolve([]);
  }

  private async requireActiveFile(id: string): Promise<ManagedFileRecord> {
    const file = await this.getFile(id);
    if (!file || file.isDeleted || file.status === "invalid") {
      throw createKnownError("FILE_NOT_FOUND");
    }
    return file;
  }

  private async compensateUpload(location: FileObjectLocation, cause: unknown): Promise<void> {
    try {
      await this.options.storage.delete(location);
    } catch (cleanupError) {
      (this.options.errorSink ?? defaultErrorSink)({
        event: "file.upload.compensation_failed",
        location,
        message: errorMessage(cleanupError, cause),
      });
    }
  }
}

function defaultErrorSink(event: FileStorageErrorEvent): void {
  console.error(JSON.stringify({ level: "error", ...event }));
}

function errorMessage(cleanupError: unknown, cause: unknown): string {
  return `Compensation failed: ${toMessage(cleanupError)}; metadata failure: ${toMessage(cause)}`;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
