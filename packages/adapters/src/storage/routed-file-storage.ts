import type { FileObjectLocation, FileStorageAdapter, FileStorageDriver } from ".";

export type RoutedFileStorageOptions = {
  activeDriver: FileStorageDriver;
  adapters: FileStorageAdapter[];
};

export function createRoutedFileStorageAdapter(
  options: RoutedFileStorageOptions,
): FileStorageAdapter {
  const adapters = indexAdapters(options.adapters);
  const active = requireAdapter(adapters, options.activeDriver);

  return {
    storageDriver: options.activeDriver,
    async healthCheck() {
      for (const adapter of adapters.values()) {
        const health = await adapter.healthCheck();
        if (!health.ok) return health;
      }
      return { ok: true };
    },
    put(objectKey, body, contentType) {
      return active.put(objectKey, body, contentType);
    },
    get(location) {
      return requireLocationAdapter(adapters, location).get(location);
    },
    delete(location) {
      return requireLocationAdapter(adapters, location).delete(location);
    },
    createDownloadUrl(location, downloadOptions) {
      return requireLocationAdapter(adapters, location).createDownloadUrl(
        location,
        downloadOptions,
      );
    },
  };
}

function indexAdapters(adapters: FileStorageAdapter[]): Map<FileStorageDriver, FileStorageAdapter> {
  const indexed = new Map<FileStorageDriver, FileStorageAdapter>();
  for (const adapter of adapters) {
    if (indexed.has(adapter.storageDriver)) {
      throw new Error(`Duplicate file storage adapter for ${adapter.storageDriver}.`);
    }
    indexed.set(adapter.storageDriver, adapter);
  }
  return indexed;
}

function requireLocationAdapter(
  adapters: Map<FileStorageDriver, FileStorageAdapter>,
  location: FileObjectLocation,
): FileStorageAdapter {
  return requireAdapter(adapters, location.storageDriver);
}

function requireAdapter(
  adapters: Map<FileStorageDriver, FileStorageAdapter>,
  driver: FileStorageDriver,
): FileStorageAdapter {
  const adapter = adapters.get(driver);
  if (!adapter) {
    throw new Error(`File storage driver ${driver} is not configured.`);
  }
  return adapter;
}
