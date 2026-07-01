import type { HealthCheckableAdapter } from "../health";

export type StoredFileObject = {
  objectKey: string;
  contentType: string;
  sizeBytes: number;
};

export type FileStorageAdapter = HealthCheckableAdapter & {
  put: (objectKey: string, body: Uint8Array, contentType: string) => Promise<StoredFileObject>;
  get: (objectKey: string) => Promise<Uint8Array | null>;
  delete: (objectKey: string) => Promise<void>;
};
