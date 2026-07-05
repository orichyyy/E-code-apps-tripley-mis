import { describe, expect, it } from "vitest";

import { createApp } from "../src/app";

describe("profile routes", () => {
  it("allows the current user to update allowed profile fields and preferences", async () => {
    const app = createApp();
    await initializeApp(app);
    const { authHeaders } = await loginAsAdmin(app);

    const profile = await requestData(app, "/api/profile", { headers: authHeaders });
    expect(profile.user.username).toBe("admin");
    expect(profile.preferences).toMatchObject({
      language: "en",
      themeMode: "light",
      themeColor: "blue",
      pageTabsEnabled: true,
    });

    const updatedProfile = await requestData(app, "/api/profile", {
      method: "PATCH",
      headers: authHeaders,
      body: {
        displayName: "Admin User",
        email: "admin-user@example.com",
        phone: "10000000001",
        gender: "not_specified",
        employeeNumber: "A-001",
      },
    });
    expect(updatedProfile.user).toMatchObject({
      id: "1",
      displayName: "Admin User",
      email: "admin-user@example.com",
      phone: "10000000001",
      gender: "not_specified",
      employeeNumber: "A-001",
    });

    const preferences = await requestData(app, "/api/profile/preferences", {
      method: "PATCH",
      headers: authHeaders,
      body: {
        language: "zh",
        themeMode: "dark",
        themeColor: "emerald",
        pageTabsEnabled: false,
      },
    });
    expect(preferences).toMatchObject({
      userId: "1",
      language: "zh",
      themeMode: "dark",
      themeColor: "emerald",
      pageTabsEnabled: false,
    });

    const avatarProfile = await requestData(app, "/api/profile/avatar", {
      method: "POST",
      headers: authHeaders,
      body: { avatarFileId: "9" },
    });
    expect(avatarProfile.user.avatarFileId).toBe("9");

    const rejected = await app.request("/api/profile", {
      method: "PATCH",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({ username: "renamed-admin" }),
    });
    expect(rejected.status).toBe(400);
  });
});

async function initializeApp(app: ReturnType<typeof createApp>): Promise<void> {
  const response = await app.request("/api/initialization/setup", {
    method: "POST",
    body: JSON.stringify({
      organizationName: "Default Organization",
      organizationCode: "default",
      adminUsername: "admin",
      adminDisplayName: "Super Admin",
      adminEmail: "admin@example.com",
      adminPhone: "10000000000",
      adminPassword: "password1",
    }),
  });
  expect(response.status).toBe(201);
}

async function loginAsAdmin(app: ReturnType<typeof createApp>) {
  const response = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "user-agent": "vitest" },
    body: JSON.stringify({ username: "admin", password: "password1" }),
  });
  const login = await response.json();
  expect(response.status).toBe(200);

  return {
    authHeaders: {
      authorization: `Bearer ${login.data.accessToken}`,
    },
  };
}

async function requestData(
  app: ReturnType<typeof createApp>,
  path: string,
  options: {
    body?: unknown;
    headers?: Record<string, string>;
    method?: string;
  } = {},
) {
  const response = await app.request(path, {
    method: options.method ?? "GET",
    headers: {
      ...(options.body === undefined ? {} : { "content-type": "application/json" }),
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const payload = await response.json();
  expect(response.status).toBe(200);
  return payload.data;
}
