import type { TokenStoreAdapter } from "@web-admin-base/adapters";

import {
  defaultPasswordPolicy,
  type PasswordPolicy
} from "../../infra/security/password-policy";
import type { InMemoryBackendStore } from "./in-memory-store";
import type { PermissionCache } from "../permissions/permission-cache";

export type BackendCoreConfig = {
  jwtSecret: string;
  jwtIssuer: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlDays: number;
  failedLoginMaxAttempts: number;
  failedLoginLockMinutes: number;
  maxOrganizationDepth: number;
  passwordPolicy: PasswordPolicy;
};

export const defaultBackendCoreConfig: BackendCoreConfig = {
  jwtSecret: "development-only-change-me",
  jwtIssuer: "web-admin-base",
  accessTokenTtlSeconds: 900,
  refreshTokenTtlDays: 30,
  failedLoginMaxAttempts: 5,
  failedLoginLockMinutes: 30,
  maxOrganizationDepth: 8,
  passwordPolicy: defaultPasswordPolicy
};

export type BackendCoreContext = {
  store: InMemoryBackendStore;
  config: BackendCoreConfig;
  permissionCache: PermissionCache;
  tokenStore: TokenStoreAdapter;
};
