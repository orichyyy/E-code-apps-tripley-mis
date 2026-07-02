import { describe, expect, it } from "vitest";

import { createInMemoryTokenStoreAdapter } from "../src";

describe("createInMemoryTokenStoreAdapter", () => {
  it("stores, finds, and revokes session tokens", async () => {
    const tokenStore = createInMemoryTokenStoreAdapter();

    await tokenStore.store({
      tokenHash: "hash-1",
      subjectId: "1",
      sessionId: "session-1",
      tokenVersion: 0,
      expiresAt: "2026-01-01T00:00:00.000Z",
      createdAt: "2025-01-01T00:00:00.000Z",
      revokedAt: null
    });

    await expect(tokenStore.findByHash("hash-1")).resolves.toMatchObject({
      subjectId: "1",
      sessionId: "session-1",
      tokenVersion: 0,
      revokedAt: null
    });

    await tokenStore.revokeBySession("session-1");

    await expect(tokenStore.findByHash("hash-1")).resolves.toMatchObject({
      revokedAt: expect.any(String)
    });
  });

  it("returns token copies and supports single-token revocation", async () => {
    const tokenStore = createInMemoryTokenStoreAdapter();

    await tokenStore.store({
      tokenHash: "hash-1",
      subjectId: "1",
      sessionId: "session-1",
      tokenVersion: 0,
      expiresAt: "2026-01-01T00:00:00.000Z",
      createdAt: "2025-01-01T00:00:00.000Z",
      revokedAt: null
    });
    await tokenStore.store({
      tokenHash: "hash-2",
      subjectId: "1",
      sessionId: "session-1",
      tokenVersion: 0,
      expiresAt: "2026-01-01T00:00:00.000Z",
      createdAt: "2025-01-01T00:00:00.000Z",
      revokedAt: null
    });

    const found = await tokenStore.findByHash("hash-1");
    if (!found) throw new Error("Expected stored token to exist");
    found.revokedAt = "mutated";

    await expect(tokenStore.findByHash("hash-1")).resolves.toMatchObject({
      revokedAt: null
    });
    await tokenStore.revoke("hash-1");
    await expect(tokenStore.findByHash("hash-1")).resolves.toMatchObject({
      revokedAt: expect.any(String)
    });
    await expect(tokenStore.findByHash("hash-2")).resolves.toMatchObject({
      revokedAt: null
    });
  });
});
