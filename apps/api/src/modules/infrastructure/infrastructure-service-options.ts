import {
  createInMemoryNotificationChannelAdapter,
  createLocalFileStorageAdapter,
  type FileStorageAdapter,
  type NotificationChannelAdapter
} from "@web-admin-base/adapters";

export type InfrastructureServiceOptions = {
  storage?: FileStorageAdapter;
  notificationChannel?: NotificationChannelAdapter;
  maxFileSizeBytes?: number;
};

export function resolveInfrastructureServiceOptions(
  options?: FileStorageAdapter | InfrastructureServiceOptions
): InfrastructureServiceOptions {
  if (!options) return {};
  if (isFileStorageAdapter(options)) return { storage: options };
  return options;
}

export function createDefaultFileStorage(): FileStorageAdapter {
  return createLocalFileStorageAdapter({
    rootDirectory: process.env.FILE_STORAGE_ROOT ?? ".web-admin-storage"
  });
}

export function createDefaultNotificationChannel(): NotificationChannelAdapter {
  return createInMemoryNotificationChannelAdapter();
}

export function readMaxFileSizeBytes(): number {
  const configured = Number(process.env.FILE_MAX_SIZE_BYTES);
  return Number.isFinite(configured) && configured > 0 ? configured : 50 * 1024 * 1024;
}

function isFileStorageAdapter(value: unknown): value is FileStorageAdapter {
  return (
    typeof value === "object" &&
    value !== null &&
    "put" in value &&
    "get" in value &&
    "delete" in value
  );
}
