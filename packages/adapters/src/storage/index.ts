import type { HealthCheckableAdapter } from "../health";

export type FileStorageDriver = "local" | "s3";

export type FileObjectLocation = {
  storageDriver: FileStorageDriver;
  storageBucket: string | null;
  objectKey: string;
};

export type StoredFileObject = FileObjectLocation & {
  contentType: string;
  sizeBytes: number;
};

export type FileDownloadUrl = {
  url: string;
  expiresAt: Date;
};

export type FileDownloadUrlOptions = {
  contentType: string;
  filename: string;
  disposition: "attachment" | "inline";
  expiresInSeconds: number;
};

export type FileStorageAdapter = HealthCheckableAdapter & {
  storageDriver: FileStorageDriver;
  put: (objectKey: string, body: Uint8Array, contentType: string) => Promise<StoredFileObject>;
  get: (location: FileObjectLocation) => Promise<Uint8Array | null>;
  delete: (location: FileObjectLocation) => Promise<void>;
  createDownloadUrl: (
    location: FileObjectLocation,
    options: FileDownloadUrlOptions,
  ) => Promise<FileDownloadUrl | null>;
};

export * from "./local-file-storage";
export * from "./routed-file-storage";
export * from "./s3-file-storage";
export * from "./storage-config";
