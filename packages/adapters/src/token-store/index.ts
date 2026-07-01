import type { HealthCheckableAdapter } from "../health";

export type StoredToken = {
  tokenHash: string;
  subjectId: string;
  expiresAt: string;
  revokedAt?: string;
};

export type TokenStoreAdapter = HealthCheckableAdapter & {
  store: (token: StoredToken) => Promise<void>;
  findByHash: (tokenHash: string) => Promise<StoredToken | null>;
  revoke: (tokenHash: string) => Promise<void>;
};
