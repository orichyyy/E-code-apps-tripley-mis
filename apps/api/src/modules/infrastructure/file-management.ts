import { randomUUID } from "node:crypto";
import { extname } from "node:path";

import { createKnownError } from "../../core/errors/error-codes";

export const defaultMaxFileSizeBytes = 50 * 1024 * 1024;
export const allowedFileExtensions = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "csv",
  "txt",
  "zip"
]);

const imagePreviewContentTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export type FileUploadInput = {
  originalName: string;
  contentType: string;
  body: Uint8Array;
  actorId: string | null;
};

export type StoredFileMetadataInput = {
  objectKey: string;
  originalName: string;
  contentType: string;
  extension: string;
  sizeBytes: number;
  storageDriver: string;
  actorId: string | null;
};

export function validateUploadInput(input: FileUploadInput, maxFileSizeBytes = defaultMaxFileSizeBytes) {
  const extension = getFileExtension(input.originalName);
  if (!allowedFileExtensions.has(extension)) {
    throw createKnownError("FILE_TYPE_NOT_ALLOWED", { extension });
  }
  if (input.body.byteLength > maxFileSizeBytes) {
    throw createKnownError("FILE_TOO_LARGE", {
      maxFileSizeBytes,
      sizeBytes: input.body.byteLength
    });
  }
  return {
    extension,
    originalName: sanitizeOriginalName(input.originalName),
    contentType: input.contentType || "application/octet-stream"
  };
}

export function createObjectKey(extension: string, now = new Date()) {
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const suffix = extension ? `.${extension}` : "";
  return `uploads/${year}/${month}/${randomUUID()}${suffix}`;
}

export function isPreviewableImage(contentType: string) {
  return imagePreviewContentTypes.has(contentType.toLowerCase());
}

export function toContentDisposition(filename: string) {
  const fallback = sanitizeOriginalName(filename).replace(/[^\w.-]/g, "_");
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeRFC5987ValueChars(filename)}`;
}

function getFileExtension(filename: string) {
  return extname(filename).replace(".", "").toLowerCase();
}

function sanitizeOriginalName(filename: string) {
  const trimmed = filename.trim().replace(/[\\/]/g, "_");
  return trimmed.length > 0 ? trimmed.slice(0, 255) : "file";
}

function encodeRFC5987ValueChars(value: string) {
  return encodeURIComponent(value).replace(/['()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
}
