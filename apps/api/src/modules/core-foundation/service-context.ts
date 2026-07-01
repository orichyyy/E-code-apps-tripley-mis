import type { InMemoryBackendStore } from "./in-memory-store";
import type { PermissionCache } from "../permissions/permission-cache";

export type BackendCoreConfig = {
  jwtSecret: string;
  jwtIssuer: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlDays: number;
  failedLoginMaxAttempts: number;
  failedLoginLockMinutes: number;
};

export const defaultBackendCoreConfig: BackendCoreConfig = {
  jwtSecret: "development-only-change-me",
  jwtIssuer: "web-admin-base",
  accessTokenTtlSeconds: 900,
  refreshTokenTtlDays: 30,
  failedLoginMaxAttempts: 5,
  failedLoginLockMinutes: 30
};

export type BackendCoreContext = {
  store: InMemoryBackendStore;
  config: BackendCoreConfig;
  permissionCache: PermissionCache;
};
