import type { HealthCheckableAdapter } from "../health";

export type StoredToken = {
  tokenHash: string;
  subjectId: string;
  sessionId: string;
  tokenVersion: number;
  expiresAt: string;
  createdAt: string;
  revokedAt?: string | null;
};

export type TokenStoreAdapter = HealthCheckableAdapter & {
  store: (token: StoredToken) => Promise<void>;
  findByHash: (tokenHash: string) => Promise<StoredToken | null>;
  revoke: (tokenHash: string) => Promise<void>;
  revokeBySession: (sessionId: string) => Promise<void>;
};

export function createInMemoryTokenStoreAdapter(): TokenStoreAdapter {
  const tokens = new Map<string, StoredToken>();

  return {
    async healthCheck() {
      return { ok: true };
    },
    async store(token) {
      tokens.set(token.tokenHash, { ...token });
    },
    async findByHash(tokenHash) {
      const token = tokens.get(tokenHash);
      return token ? { ...token } : null;
    },
    async revoke(tokenHash) {
      const token = tokens.get(tokenHash);
      if (token) token.revokedAt = new Date().toISOString();
    },
    async revokeBySession(sessionId) {
      const revokedAt = new Date().toISOString();
      for (const token of tokens.values()) {
        if (token.sessionId === sessionId) token.revokedAt = revokedAt;
      }
    },
  };
}
