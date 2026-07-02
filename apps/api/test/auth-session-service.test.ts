import { describe, expect, it } from "vitest";

import { createInMemoryBackendCoreServices } from "../src/modules/core-foundation/services";

async function createInitializedServices(config?: Parameters<typeof createInMemoryBackendCoreServices>[0]) {
  const services = createInMemoryBackendCoreServices(config);
  await services.initialize({
    organizationName: "Default Organization",
    organizationCode: "default",
    adminUsername: "admin",
    adminDisplayName: "Super Admin",
    adminEmail: "admin@example.com",
    adminPhone: "10000000000",
    adminPassword: "password1"
  });
  return services;
}

describe("Auth session service", () => {
  it("excludes expired sessions when listing online users", async () => {
    const services = await createInitializedServices({ refreshTokenTtlDays: 0 });
    const login = await services.auth.login(
      { username: "admin", password: "password1" },
      { ipAddress: "127.0.0.1", userAgent: "vitest" }
    );

    const onlineUsers = services.listOnlineUsers();

    expect(onlineUsers).toEqual([]);
    expect(login.session).not.toHaveProperty("refreshTokenHash");
  });

  it("marks the backing session expired when refresh-token exchange is expired", async () => {
    const services = await createInitializedServices({ refreshTokenTtlDays: 0 });
    const login = await services.auth.login(
      { username: "admin", password: "password1" },
      { ipAddress: "127.0.0.1", userAgent: "vitest" }
    );

    await expect(services.refreshAccessToken(login.refreshToken)).rejects.toMatchObject({
      code: "AUTH_TOKEN_EXPIRED"
    });

    expect(services["context"].store.authSessions.get(login.session.id)).toMatchObject({
      id: login.session.id,
      status: "expired",
      revokedAt: null
    });
    expect(services.listOnlineUsers()).toEqual([]);
  });

  it("rejects refresh-token exchange when the backing login session is expired", async () => {
    const services = await createInitializedServices({ refreshTokenTtlDays: 1 });
    const login = await services.auth.login(
      { username: "admin", password: "password1" },
      { ipAddress: "127.0.0.1", userAgent: "vitest" }
    );
    const session = services["context"].store.authSessions.get(login.session.id);
    if (!session) throw new Error("Expected login session to exist");
    session.expiresAt = "2026-01-01T00:00:00.000Z";

    await expect(services.refreshAccessToken(login.refreshToken)).rejects.toMatchObject({
      code: "AUTH_TOKEN_EXPIRED"
    });

    expect(session).toMatchObject({
      id: login.session.id,
      status: "expired",
      revokedAt: null
    });
  });
});
