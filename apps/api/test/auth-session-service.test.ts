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
  it("marks expired sessions as expired when listing online users", async () => {
    const services = await createInitializedServices({ refreshTokenTtlDays: 0 });
    const login = await services.auth.login(
      { username: "admin", password: "password1" },
      { ipAddress: "127.0.0.1", userAgent: "vitest" }
    );

    const onlineUsers = services.listOnlineUsers();

    expect(onlineUsers).toEqual([]);
    expect(login.session.status).toBe("expired");
  });
});
