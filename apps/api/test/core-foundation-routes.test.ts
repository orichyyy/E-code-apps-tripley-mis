import { describe, expect, it } from "vitest";

import { createApp } from "../src/app";
import { createInMemoryBackendCoreServices } from "../src/modules/core-foundation/services";
import { defaultPasswordPolicy } from "../src/infra/security/password-policy";

async function setupInitializedApp(app = createApp()) {
  const setupResponse = await app.request("/api/initialization/setup", {
    method: "POST",
    body: JSON.stringify({
      organizationName: "Default Organization",
      organizationCode: "default",
      adminUsername: "admin",
      adminDisplayName: "Super Admin",
      adminEmail: "admin@example.com",
      adminPhone: "10000000000",
      adminPassword: "password1"
    })
  });
  const setup = await setupResponse.json();
  return { app, setup };
}

async function loginAsAdmin(app: ReturnType<typeof createApp>) {
  const loginResponse = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "user-agent": "vitest" },
    body: JSON.stringify({ username: "admin", password: "password1" })
  });
  const login = await loginResponse.json();
  return {
    login,
    loginResponse,
    authHeaders: {
      authorization: `Bearer ${login.data.accessToken}`
    }
  };
}

describe("backend core foundation routes", () => {
  it("supports first-start initialization and exposes initialized status", async () => {
    const { app, setup } = await setupInitializedApp();
    const statusResponse = await app.request("/api/initialization/status");
    const status = await statusResponse.json();

    expect(setupResponseStatus(setup)).toBe("initialized");
    expect(setup.data.organization.id).toBe("1");
    expect(setup.data.admin.id).toBe("1");
    expect(setup.data.permissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(String),
          code: "user:view",
          resource: "user",
          action: "view",
          source: "base_manifest",
          manifestHash: expect.stringMatching(/^[a-f0-9]{64}$/)
        })
      ])
    );
    expect(setup.data.apiPermissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(String),
          code: "api.auth.login",
          path: "/api/auth/login"
        })
      ])
    );
    expect(setup.data.roles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "super_admin",
          description: "Built-in role",
          isBuiltin: true,
          dataScopeRuleId: null
        })
      ])
    );
    expect(status.data.initialized).toBe(true);
  });

  it("supports PRD-compatible setup initialization aliases", async () => {
    const app = createApp();
    const initialStatusResponse = await app.request("/api/setup/status");
    const initialStatus = await initialStatusResponse.json();
    const setupResponse = await app.request("/api/setup/initialize", {
      method: "POST",
      body: JSON.stringify({
        organizationName: "Alias Organization",
        organizationCode: "alias",
        adminUsername: "alias-admin",
        adminDisplayName: "Alias Admin",
        adminEmail: "alias-admin@example.com",
        adminPhone: "10000000001",
        adminPassword: "password1"
      })
    });
    const setup = await setupResponse.json();
    const finalStatusResponse = await app.request("/api/setup/status");
    const finalStatus = await finalStatusResponse.json();
    const duplicateResponse = await app.request("/api/initialization/setup", {
      method: "POST",
      body: JSON.stringify({
        organizationName: "Duplicate Organization",
        organizationCode: "duplicate",
        adminUsername: "duplicate-admin",
        adminDisplayName: "Duplicate Admin",
        adminEmail: "duplicate-admin@example.com",
        adminPhone: "10000000002",
        adminPassword: "password1"
      })
    });
    const duplicate = await duplicateResponse.json();

    expect(initialStatusResponse.status).toBe(200);
    expect(initialStatus.data.initialized).toBe(false);
    expect(setupResponse.status).toBe(201);
    expect(setup.data.state.status).toBe("initialized");
    expect(finalStatusResponse.status).toBe(200);
    expect(finalStatus.data.initialized).toBe(true);
    expect(duplicateResponse.status).toBe(409);
    expect(duplicate.error.code).toBe("BUSINESS_SYSTEM_ALREADY_INITIALIZED");
  });

  it("rejects first-start initialization when the administrator password violates policy", async () => {
    const app = createApp();
    const setupResponse = await app.request("/api/initialization/setup", {
      method: "POST",
      body: JSON.stringify({
        organizationName: "Default Organization",
        organizationCode: "default",
        adminUsername: "admin",
        adminDisplayName: "Super Admin",
        adminEmail: "admin@example.com",
        adminPhone: "10000000000",
        adminPassword: "password"
      })
    });
    const setup = await setupResponse.json();
    const statusResponse = await app.request("/api/initialization/status");
    const status = await statusResponse.json();

    expect(setupResponse.status).toBe(400);
    expect(setup.error.code).toBe("PASSWORD_REQUIRES_NUMBER");
    expect(status.data.initialized).toBe(false);
  });

  it("logs in with username/password, creates a session, and lists online users", async () => {
    const { app } = await setupInitializedApp();
    const { login, loginResponse, authHeaders } = await loginAsAdmin(app);
    const onlineUsersResponse = await app.request("/api/online-users", {
      headers: authHeaders
    });
    const onlineUsers = await onlineUsersResponse.json();

    expect(loginResponse.headers.get("set-cookie")).toContain("HttpOnly");
    expect(login.data.accessToken).toEqual(expect.any(String));
    expect(login.data.session.id).toBe("1");
    expect(login.data.session.status).toBe("active");
    expect(login.data.session.tokenVersion).toBe(0);
    expect(login.data.session).not.toHaveProperty("refreshTokenHash");
    expect(login.data.currentOrganization).toMatchObject({ id: "1", code: "default" });
    expect(login.data.organizations).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "1", code: "default" })])
    );
    expect(login.data.permissionCodes).toEqual(expect.arrayContaining(["user:view", "role:view"]));
    expect(login.data.menus).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "system.users" })])
    );
    expect(login.data.passwordChangeRequired).toBe(false);
    expect(onlineUsers.data).toHaveLength(1);
    expect(onlineUsers.data[0].status).toBe("active");
    expect(onlineUsers.data[0].tokenVersion).toBe(0);
    expect(onlineUsers.data[0]).not.toHaveProperty("refreshTokenHash");
  });

  it("filters and pages the online-user session data source", async () => {
    const { app } = await setupInitializedApp();
    const firstLogin = await loginAsAdmin(app);
    await loginAsAdmin(app);

    const filteredResponse = await app.request("/api/online-users?userId=1&organizationId=1", {
      headers: firstLogin.authHeaders
    });
    const filtered = await filteredResponse.json();
    const pagedResponse = await app.request("/api/online-users?userId=1&page=1&pageSize=1", {
      headers: firstLogin.authHeaders
    });
    const paged = await pagedResponse.json();

    expect(filteredResponse.status).toBe(200);
    expect(filtered.data).toHaveLength(2);
    expect(filtered.data).toEqual([
      expect.objectContaining({ userId: "1", currentOrganizationId: "1" }),
      expect.objectContaining({ userId: "1", currentOrganizationId: "1" })
    ]);
    expect(pagedResponse.status).toBe(200);
    expect(paged.data).toMatchObject({
      page: 1,
      pageSize: 1,
      total: 2,
      totalPages: 2
    });
    expect(paged.data.items).toEqual([
      expect.objectContaining({ userId: "1", currentOrganizationId: "1" })
    ]);
  });

  it("rejects invalid online-user query parameters", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);

    const userResponse = await app.request("/api/online-users?userId=not-an-id", {
      headers: authHeaders
    });
    const userBody = await userResponse.json();
    const organizationResponse = await app.request("/api/online-users?organizationId=0", {
      headers: authHeaders
    });
    const organizationBody = await organizationResponse.json();
    const pageResponse = await app.request("/api/online-users?pageSize=0", {
      headers: authHeaders
    });
    const pageBody = await pageResponse.json();

    expect(userResponse.status).toBe(400);
    expect(userBody.error.code).toBe("VALIDATION_INVALID_REQUEST");
    expect(organizationResponse.status).toBe(400);
    expect(organizationBody.error.code).toBe("VALIDATION_INVALID_REQUEST");
    expect(pageResponse.status).toBe(400);
    expect(pageBody.error.code).toBe("VALIDATION_INVALID_REQUEST");
  });

  it("updates session last seen time on authenticated API activity", async () => {
    const { app } = await setupInitializedApp();
    const { login, authHeaders } = await loginAsAdmin(app);

    await new Promise((resolve) => setTimeout(resolve, 5));
    await app.request("/api/auth/me", { headers: authHeaders });
    const onlineUsersResponse = await app.request("/api/online-users", {
      headers: authHeaders
    });
    const onlineUsers = await onlineUsersResponse.json();

    expect(new Date(onlineUsers.data[0].lastSeenAt).getTime()).toBeGreaterThan(
      new Date(login.data.session.lastSeenAt).getTime()
    );
  });

  it("keeps old user tokens invalid after disabling and re-enabling the account", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    await app.request("/api/users", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        username: "disable-token-user",
        displayName: "Disable Token User",
        email: "disable-token-user@example.com",
        phone: "10000000014",
        password: "password1",
        primaryOrganizationId: "1",
        roleId: "3"
      })
    });

    const firstLoginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "disable-token-user", password: "password1" })
    });
    const firstLogin = await firstLoginResponse.json();
    await app.request("/api/auth/change-password", {
      method: "POST",
      headers: { authorization: `Bearer ${firstLogin.data.accessToken}` },
      body: JSON.stringify({ oldPassword: "password1", newPassword: "password2" })
    });
    const loginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "disable-token-user", password: "password2" })
    });
    const login = await loginResponse.json();
    const cookie = loginResponse.headers.get("set-cookie") ?? "";
    await app.request(`/api/users/${login.data.user.id}/disable`, {
      method: "POST",
      headers: authHeaders
    });
    await app.request(`/api/users/${login.data.user.id}/enable`, {
      method: "POST",
      headers: authHeaders
    });

    const oldAccessResponse = await app.request("/api/auth/me", {
      headers: { authorization: `Bearer ${login.data.accessToken}` }
    });
    const oldAccess = await oldAccessResponse.json();
    const oldRefreshResponse = await app.request("/api/auth/refresh", {
      method: "POST",
      headers: { cookie: cookie.split(";")[0] }
    });
    const oldRefresh = await oldRefreshResponse.json();
    const onlineUsersResponse = await app.request("/api/online-users", {
      headers: authHeaders
    });
    const onlineUsers = await onlineUsersResponse.json();

    expect(login.data.session.tokenVersion).toBe(1);
    expect(oldAccessResponse.status).toBe(401);
    expect(oldAccess.error.code).toBe("AUTH_TOKEN_INVALIDATED");
    expect(oldRefreshResponse.status).toBe(401);
    expect(oldRefresh.error.code).toBe("AUTH_TOKEN_INVALIDATED");
    expect(onlineUsers.data).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ userId: login.data.user.id })])
    );
  });

  it("keeps old user tokens invalid after locking and unlocking the account", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    await app.request("/api/users", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        username: "lock-token-user",
        displayName: "Lock Token User",
        email: "lock-token-user@example.com",
        phone: "10000000017",
        password: "password1",
        primaryOrganizationId: "1",
        roleId: "3"
      })
    });

    const firstLoginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "lock-token-user", password: "password1" })
    });
    const firstLogin = await firstLoginResponse.json();
    await app.request("/api/auth/change-password", {
      method: "POST",
      headers: { authorization: `Bearer ${firstLogin.data.accessToken}` },
      body: JSON.stringify({ oldPassword: "password1", newPassword: "password2" })
    });
    const loginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "lock-token-user", password: "password2" })
    });
    const login = await loginResponse.json();
    const cookie = loginResponse.headers.get("set-cookie") ?? "";
    const lockResponse = await app.request(`/api/users/${login.data.user.id}/lock`, {
      method: "POST",
      headers: authHeaders
    });
    const locked = await lockResponse.json();
    await app.request(`/api/users/${login.data.user.id}/unlock`, {
      method: "POST",
      headers: authHeaders
    });

    const oldAccessResponse = await app.request("/api/auth/me", {
      headers: { authorization: `Bearer ${login.data.accessToken}` }
    });
    const oldAccess = await oldAccessResponse.json();
    const oldRefreshResponse = await app.request("/api/auth/refresh", {
      method: "POST",
      headers: { cookie: cookie.split(";")[0] }
    });
    const oldRefresh = await oldRefreshResponse.json();

    expect(lockResponse.status).toBe(200);
    expect(locked.data.tokenVersion).toBe(login.data.user.tokenVersion + 1);
    expect(oldAccessResponse.status).toBe(401);
    expect(oldAccess.error.code).toBe("AUTH_TOKEN_INVALIDATED");
    expect(oldRefreshResponse.status).toBe(401);
    expect(oldRefresh.error.code).toBe("AUTH_TOKEN_INVALIDATED");
  });

  it("invalidates access and refresh tokens when a user is soft deleted", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    await app.request("/api/users", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        username: "delete-token-user",
        displayName: "Delete Token User",
        email: "delete-token-user@example.com",
        phone: "10000000015",
        password: "password1",
        primaryOrganizationId: "1",
        roleId: "3"
      })
    });
    const firstLoginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "delete-token-user", password: "password1" })
    });
    const firstLogin = await firstLoginResponse.json();
    await app.request("/api/auth/change-password", {
      method: "POST",
      headers: { authorization: `Bearer ${firstLogin.data.accessToken}` },
      body: JSON.stringify({ oldPassword: "password1", newPassword: "password2" })
    });
    const loginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "delete-token-user", password: "password2" })
    });
    const login = await loginResponse.json();
    const cookie = loginResponse.headers.get("set-cookie") ?? "";

    const deleteResponse = await app.request(`/api/users/${login.data.user.id}`, {
      method: "DELETE",
      headers: authHeaders
    });
    const deleted = await deleteResponse.json();
    const oldAccessResponse = await app.request("/api/auth/me", {
      headers: { authorization: `Bearer ${login.data.accessToken}` }
    });
    const oldAccess = await oldAccessResponse.json();
    const oldRefreshResponse = await app.request("/api/auth/refresh", {
      method: "POST",
      headers: { cookie: cookie.split(";")[0] }
    });
    const oldRefresh = await oldRefreshResponse.json();

    expect(deleted.data).toMatchObject({
      id: login.data.user.id,
      isDeleted: true,
      tokenVersion: login.data.user.tokenVersion + 1
    });
    expect(oldAccessResponse.status).toBe(401);
    expect(oldAccess.error.code).toBe("AUTH_TOKEN_INVALIDATED");
    expect(oldRefreshResponse.status).toBe(401);
    expect(oldRefresh.error.code).toBe("AUTH_TOKEN_INVALIDATED");
  });

  it("denies login for a soft-deleted user", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    await app.request("/api/users", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        username: "deleted-login-user",
        displayName: "Deleted Login User",
        email: "deleted-login-user@example.com",
        phone: "10000000019",
        password: "password1",
        primaryOrganizationId: "1",
        roleId: "3"
      })
    });
    const firstLoginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "deleted-login-user", password: "password1" })
    });
    const firstLogin = await firstLoginResponse.json();

    await app.request(`/api/users/${firstLogin.data.user.id}`, {
      method: "DELETE",
      headers: authHeaders
    });
    const deletedLoginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "deleted-login-user", password: "password1" })
    });
    const deletedLogin = await deletedLoginResponse.json();

    expect(deletedLoginResponse.status).toBe(401);
    expect(deletedLogin.error.code).toBe("AUTH_INVALID_CREDENTIALS");
  });

  it("invalidates access and refresh tokens when an administrator resets a password", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    const userResponse = await app.request("/api/users", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        username: "reset-token-user",
        displayName: "Reset Token User",
        email: "reset-token-user@example.com",
        phone: "10000000016",
        password: "password1",
        primaryOrganizationId: "1",
        roleId: "3"
      })
    });
    const user = await userResponse.json();
    const firstLoginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "reset-token-user", password: "password1" })
    });
    const firstLogin = await firstLoginResponse.json();
    await app.request("/api/auth/change-password", {
      method: "POST",
      headers: { authorization: `Bearer ${firstLogin.data.accessToken}` },
      body: JSON.stringify({ oldPassword: "password1", newPassword: "password2" })
    });
    const loginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "reset-token-user", password: "password2" })
    });
    const login = await loginResponse.json();
    const cookie = loginResponse.headers.get("set-cookie") ?? "";

    const resetResponse = await app.request(`/api/users/${user.data.id}/reset-password`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ password: "password3" })
    });
    const reset = await resetResponse.json();
    const oldAccessResponse = await app.request("/api/auth/me", {
      headers: { authorization: `Bearer ${login.data.accessToken}` }
    });
    const oldAccess = await oldAccessResponse.json();
    const oldRefreshResponse = await app.request("/api/auth/refresh", {
      method: "POST",
      headers: { cookie: cookie.split(";")[0] }
    });
    const oldRefresh = await oldRefreshResponse.json();
    const onlineUsersResponse = await app.request("/api/online-users", {
      headers: authHeaders
    });
    const onlineUsers = await onlineUsersResponse.json();

    expect(resetResponse.status).toBe(200);
    expect(reset.data).toMatchObject({
      id: user.data.id,
      firstLoginPasswordChangeRequired: true,
      tokenVersion: login.data.user.tokenVersion + 1
    });
    expect(oldAccessResponse.status).toBe(401);
    expect(oldAccess.error.code).toBe("AUTH_TOKEN_INVALIDATED");
    expect(oldRefreshResponse.status).toBe(401);
    expect(oldRefresh.error.code).toBe("AUTH_TOKEN_INVALIDATED");
    expect(onlineUsers.data).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ userId: user.data.id })])
    );
  });

  it("returns current user context with organizations, permissions, and menus", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    const response = await app.request("/api/auth/me", { headers: authHeaders });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.user.username).toBe("admin");
    expect(body.data.session.currentOrganizationId).toBe("1");
    expect(body.data.session).not.toHaveProperty("refreshTokenHash");
    expect(body.data.currentOrganization.id).toBe("1");
    expect(body.data.organizations).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "1" })])
    );
    expect(body.data.permissionCodes).toEqual(expect.arrayContaining(["user:view", "role:view"]));
    expect(body.data.menus).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "system.users" })])
    );
    expect(body.data.passwordChangeRequired).toBe(false);
  });

  it("lists organizations available to the current user context", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    const childResponse = await app.request("/api/organizations", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ parentOrganizationId: "1", name: "Child", code: "child" })
    });
    const child = await childResponse.json();
    await app.request("/api/users", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        username: "context-org-user",
        displayName: "Context Org User",
        email: "context-org-user@example.com",
        phone: "10000000012",
        password: "password1",
        primaryOrganizationId: "1",
        roleId: "3"
      })
    });
    const firstLoginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "context-org-user", password: "password1" })
    });
    const firstLogin = await firstLoginResponse.json();
    await app.request("/api/auth/change-password", {
      method: "POST",
      headers: { authorization: `Bearer ${firstLogin.data.accessToken}` },
      body: JSON.stringify({ oldPassword: "password1", newPassword: "password2" })
    });
    const loginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "context-org-user", password: "password2" })
    });
    const login = await loginResponse.json();

    const adminResponse = await app.request("/api/context/organizations", { headers: authHeaders });
    const adminOrganizations = await adminResponse.json();
    const userResponse = await app.request("/api/context/organizations", {
      headers: { authorization: `Bearer ${login.data.accessToken}` }
    });
    const userOrganizations = await userResponse.json();

    expect(adminResponse.status).toBe(200);
    expect(adminOrganizations.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "1" }),
        expect.objectContaining({ id: child.data.id })
      ])
    );
    expect(userResponse.status).toBe(200);
    expect(userOrganizations.data).toEqual([expect.objectContaining({ id: "1" })]);
  });

  it("returns the current permission context", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    const response = await app.request("/api/context/permissions", { headers: authHeaders });
    const body = await response.json();
    const effectiveResponse = await app.request("/api/permissions/effective", {
      headers: authHeaders
    });
    const effective = await effectiveResponse.json();

    expect(response.status).toBe(200);
    expect(body.data.currentOrganization.id).toBe("1");
    expect(body.data.permissionCodes).toEqual(expect.arrayContaining(["menu:view", "user:view"]));
    expect(body.data.menus).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "system.users" })])
    );
    expect(effectiveResponse.status).toBe(200);
    expect(effective.data.permissionCodes).toEqual(expect.arrayContaining(["menu:view", "user:view"]));
  });

  it("refreshes an access token from the HttpOnly refresh-token cookie design", async () => {
    const { app } = await setupInitializedApp();
    const loginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "admin", password: "password1" })
    });
    const cookie = loginResponse.headers.get("set-cookie") ?? "";
    const refreshResponse = await app.request("/api/auth/refresh", {
      method: "POST",
      headers: {
        cookie: cookie.split(";")[0]
      }
    });
    const refresh = await refreshResponse.json();

    expect(refresh.data.accessToken).toEqual(expect.any(String));
    expect(refresh.data.session.id).toBe("1");
    expect(refresh.data.session).not.toHaveProperty("refreshTokenHash");
  });

  it("updates session last seen time on refresh-token exchange", async () => {
    const { app } = await setupInitializedApp();
    const loginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "admin", password: "password1" })
    });
    const login = await loginResponse.json();
    const cookie = loginResponse.headers.get("set-cookie") ?? "";

    await new Promise((resolve) => setTimeout(resolve, 5));
    const refreshResponse = await app.request("/api/auth/refresh", {
      method: "POST",
      headers: { cookie: cookie.split(";")[0] }
    });
    const refresh = await refreshResponse.json();

    expect(refreshResponse.status).toBe(200);
    expect(new Date(refresh.data.session.lastSeenAt).getTime()).toBeGreaterThan(
      new Date(login.data.session.lastSeenAt).getTime()
    );
  });

  it("does not require a bearer access token for public refresh-token exchange", async () => {
    const { app } = await setupInitializedApp();
    const loginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "admin", password: "password1" })
    });
    const cookie = loginResponse.headers.get("set-cookie") ?? "";

    const refreshResponse = await app.request("/api/auth/refresh", {
      method: "POST",
      headers: {
        authorization: "Bearer not-a-valid-access-token",
        cookie: cookie.split(";")[0]
      }
    });
    const refresh = await refreshResponse.json();

    expect(refreshResponse.status).toBe(200);
    expect(refresh.data.accessToken).toEqual(expect.any(String));
    expect(refresh.data.session.id).toBe("1");
  });

  it("returns a stable auth error for malformed refresh-token cookies", async () => {
    const { app } = await setupInitializedApp();
    const response = await app.request("/api/auth/refresh", {
      method: "POST",
      headers: { cookie: "refresh_token=%" }
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("AUTH_TOKEN_EXPIRED");
  });

  it("uses the configured refresh token TTL for the HttpOnly cookie lifetime", async () => {
    const services = createInMemoryBackendCoreServices({ refreshTokenTtlDays: 2 });
    const { app } = await setupInitializedApp(createApp({ backendCoreServices: services }));
    const loginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "admin", password: "password1" })
    });
    const login = await loginResponse.json();
    const cookie = loginResponse.headers.get("set-cookie") ?? "";

    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Path=/api/auth/refresh");
    expect(cookie).toContain("Max-Age=172800");
    expect(login.data.refreshTokenCookie).toMatchObject({
      name: "refresh_token",
      httpOnly: true,
      sameSite: "Strict",
      path: "/api/auth/refresh",
      maxAgeSeconds: 172800
    });
  });

  it("rejects refresh token exchange after the account is disabled", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    await app.request("/api/users", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        username: "refresh-disabled",
        displayName: "Refresh Disabled",
        email: "refresh-disabled@example.com",
        phone: "10000000010",
        password: "password1",
        primaryOrganizationId: "1",
        roleId: "3"
      })
    });
    const loginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "refresh-disabled", password: "password1" })
    });
    const login = await loginResponse.json();
    const cookie = loginResponse.headers.get("set-cookie") ?? "";
    await app.request(`/api/users/${login.data.user.id}/disable`, {
      method: "POST",
      headers: authHeaders
    });

    const refreshResponse = await app.request("/api/auth/refresh", {
      method: "POST",
      headers: { cookie: cookie.split(";")[0] }
    });
    const refresh = await refreshResponse.json();

    expect(refreshResponse.status).toBe(403);
    expect(refresh.error.code).toBe("AUTH_ACCOUNT_DISABLED");
  });

  it("rejects refresh token exchange when the current organization is disabled", async () => {
    const { app } = await setupInitializedApp();
    const loginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "admin", password: "password1" })
    });
    const login = await loginResponse.json();
    const cookie = loginResponse.headers.get("set-cookie") ?? "";
    await app.request("/api/organizations/1/disable", {
      method: "POST",
      headers: { authorization: `Bearer ${login.data.accessToken}` }
    });

    const refreshResponse = await app.request("/api/auth/refresh", {
      method: "POST",
      headers: { cookie: cookie.split(";")[0] }
    });
    const refresh = await refreshResponse.json();

    expect(refreshResponse.status).toBe(409);
    expect(refresh.error.code).toBe("BUSINESS_ORG_DISABLED");
  });

  it("rejects refresh token exchange when the current organization is soft deleted", async () => {
    const { app } = await setupInitializedApp();
    const loginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "admin", password: "password1" })
    });
    const login = await loginResponse.json();
    const cookie = loginResponse.headers.get("set-cookie") ?? "";
    const authHeaders = { authorization: `Bearer ${login.data.accessToken}` };
    const childResponse = await app.request("/api/organizations", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        parentOrganizationId: "1",
        name: "Deleted Session Organization",
        code: "deleted-session-organization"
      })
    });
    const child = await childResponse.json();
    const switchResponse = await app.request("/api/context/current-organization", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ organizationId: child.data.id })
    });
    const switched = await switchResponse.json();

    await app.request(`/api/organizations/${child.data.id}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${switched.data.accessToken}` }
    });
    const refreshResponse = await app.request("/api/auth/refresh", {
      method: "POST",
      headers: { cookie: cookie.split(";")[0] }
    });
    const refresh = await refreshResponse.json();

    expect(refreshResponse.status).toBe(409);
    expect(refresh.error.code).toBe("BUSINESS_ORG_DISABLED");
  });

  it("excludes sessions from online users when their current organization is disabled", async () => {
    const { app } = await setupInitializedApp();
    const firstLoginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "admin", password: "password1" })
    });
    const firstLogin = await firstLoginResponse.json();
    const firstHeaders = { authorization: `Bearer ${firstLogin.data.accessToken}` };
    const alternateResponse = await app.request("/api/organizations", {
      method: "POST",
      headers: firstHeaders,
      body: JSON.stringify({ name: "Online Alternate", code: "online-alternate" })
    });
    const alternate = await alternateResponse.json();
    const secondLoginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "admin", password: "password1" })
    });
    const secondLogin = await secondLoginResponse.json();
    const secondSwitchResponse = await app.request("/api/context/current-organization", {
      method: "POST",
      headers: { authorization: `Bearer ${secondLogin.data.accessToken}` },
      body: JSON.stringify({ organizationId: alternate.data.id })
    });
    const secondSwitch = await secondSwitchResponse.json();
    const alternateHeaders = { authorization: `Bearer ${secondSwitch.data.accessToken}` };
    const beforeDisableResponse = await app.request("/api/online-users", {
      headers: alternateHeaders
    });
    const beforeDisable = await beforeDisableResponse.json();

    await app.request("/api/organizations/1/disable", {
      method: "POST",
      headers: alternateHeaders
    });
    const afterDisableResponse = await app.request("/api/online-users", {
      headers: alternateHeaders
    });
    const afterDisable = await afterDisableResponse.json();

    expect(beforeDisable.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: firstLogin.data.session.id }),
        expect.objectContaining({ id: secondSwitch.data.session.id })
      ])
    );
    expect(afterDisable.data).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: firstLogin.data.session.id })])
    );
    expect(afterDisable.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: secondSwitch.data.session.id })])
    );
  });

  it("excludes sessions from online users when their current organization is soft deleted", async () => {
    const { app } = await setupInitializedApp();
    const firstLoginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "admin", password: "password1" })
    });
    const firstLogin = await firstLoginResponse.json();
    const firstHeaders = { authorization: `Bearer ${firstLogin.data.accessToken}` };
    const alternateResponse = await app.request("/api/organizations", {
      method: "POST",
      headers: firstHeaders,
      body: JSON.stringify({ name: "Deleted Online Alternate", code: "deleted-online-alternate" })
    });
    const alternate = await alternateResponse.json();
    await app.request(`/api/users/${firstLogin.data.user.id}/organizations`, {
      method: "POST",
      headers: firstHeaders,
      body: JSON.stringify({ organizationId: alternate.data.id, roleId: "1" })
    });
    const secondLoginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "admin", password: "password1" })
    });
    const secondLogin = await secondLoginResponse.json();
    const secondSwitchResponse = await app.request("/api/context/current-organization", {
      method: "POST",
      headers: { authorization: `Bearer ${secondLogin.data.accessToken}` },
      body: JSON.stringify({ organizationId: alternate.data.id })
    });
    const secondSwitch = await secondSwitchResponse.json();
    const alternateHeaders = { authorization: `Bearer ${secondSwitch.data.accessToken}` };
    const beforeDeleteResponse = await app.request("/api/online-users", {
      headers: alternateHeaders
    });
    const beforeDelete = await beforeDeleteResponse.json();

    await app.request("/api/organizations/1", {
      method: "DELETE",
      headers: alternateHeaders
    });
    const afterDeleteResponse = await app.request("/api/online-users", {
      headers: alternateHeaders
    });
    const afterDelete = await afterDeleteResponse.json();

    expect(beforeDelete.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: firstLogin.data.session.id }),
        expect.objectContaining({ id: secondSwitch.data.session.id })
      ])
    );
    expect(afterDelete.data).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: firstLogin.data.session.id })])
    );
    expect(afterDelete.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: secondSwitch.data.session.id })])
    );
  });

  it("revokes refresh-token usage when logging out", async () => {
    const { app } = await setupInitializedApp();
    const loginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "admin", password: "password1" })
    });
    const login = await loginResponse.json();
    const cookie = loginResponse.headers.get("set-cookie") ?? "";

    const logoutResponse = await app.request("/api/auth/logout", {
      method: "POST",
      headers: { authorization: `Bearer ${login.data.accessToken}` },
      body: JSON.stringify({ sessionId: login.data.session.id })
    });
    const logout = await logoutResponse.json();
    const refreshResponse = await app.request("/api/auth/refresh", {
      method: "POST",
      headers: { cookie: cookie.split(";")[0] }
    });
    const refresh = await refreshResponse.json();

    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.headers.get("set-cookie")).toContain("refresh_token=");
    expect(logoutResponse.headers.get("set-cookie")).toContain("Path=/api/auth/refresh");
    expect(logoutResponse.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(logout.data.status).toBe("revoked");
    expect(logout.data).not.toHaveProperty("refreshTokenHash");
    expect(refreshResponse.status).toBe(401);
    expect(refresh.error.code).toBe("AUTH_TOKEN_EXPIRED");
  });

  it("logs out the current authenticated session without requiring a session body", async () => {
    const { app } = await setupInitializedApp();
    const loginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "admin", password: "password1" })
    });
    const login = await loginResponse.json();

    const logoutResponse = await app.request("/api/auth/logout", {
      method: "POST",
      headers: { authorization: `Bearer ${login.data.accessToken}` }
    });
    const oldTokenResponse = await app.request("/api/auth/me", {
      headers: { authorization: `Bearer ${login.data.accessToken}` }
    });
    const oldToken = await oldTokenResponse.json();

    expect(logoutResponse.status).toBe(200);
    expect(oldTokenResponse.status).toBe(401);
    expect(oldToken.error.code).toBe("AUTH_SESSION_NOT_FOUND");
  });

  it("rejects logout attempts for another session id", async () => {
    const { app } = await setupInitializedApp();
    const loginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "admin", password: "password1" })
    });
    const login = await loginResponse.json();

    const response = await app.request("/api/auth/logout", {
      method: "POST",
      headers: { authorization: `Bearer ${login.data.accessToken}` },
      body: JSON.stringify({ sessionId: "999" })
    });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("PERMISSION_DENIED");
  });

  it("creates child organizations and disables descendants when a parent is disabled", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    const childResponse = await app.request("/api/organizations", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        parentOrganizationId: "1",
        name: "Child Organization",
        code: "child"
      })
    });
    const child = await childResponse.json();
    const alternateResponse = await app.request("/api/organizations", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ name: "Alternate Root", code: "alternate-root" })
    });
    const alternate = await alternateResponse.json();
    const switchResponse = await app.request("/api/context/current-organization", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ organizationId: alternate.data.id })
    });
    const switched = await switchResponse.json();
    const alternateHeaders = { authorization: `Bearer ${switched.data.accessToken}` };
    const disabledResponse = await app.request("/api/organizations/1/disable", {
      method: "POST",
      headers: alternateHeaders
    });
    const disabled = await disabledResponse.json();
    const treeResponse = await app.request("/api/organizations/tree", { headers: alternateHeaders });
    const tree = await treeResponse.json();
    const detailResponse = await app.request(`/api/organizations/${child.data.id}`, {
      headers: alternateHeaders
    });
    const detail = await detailResponse.json();
    const enableChildResponse = await app.request(`/api/organizations/${child.data.id}/enable`, {
      method: "POST",
      headers: alternateHeaders
    });
    const enableChild = await enableChildResponse.json();

    expect(child.data.level).toBe(2);
    expect(child.data.path).toEqual(expect.any(String));
    expect(disabled.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "1", status: "disabled" }),
        expect.objectContaining({ id: "2", status: "disabled" })
      ])
    );
    expect(treeResponse.status).toBe(200);
    expect(tree.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "1",
          status: "disabled",
          children: expect.arrayContaining([
            expect.objectContaining({ id: child.data.id, status: "disabled", children: [] })
          ])
        })
      ])
    );
    expect(detailResponse.status).toBe(200);
    expect(detail.data).toMatchObject({ id: child.data.id, status: "disabled" });
    expect(enableChildResponse.status).toBe(409);
    expect(enableChild.error.code).toBe("BUSINESS_ORG_DISABLED");
  });

  it("creates and updates organization contact fields", async () => {
    const { app, setup } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    const createResponse = await app.request("/api/organizations", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        parentOrganizationId: "1",
        name: "Contact Organization",
        code: "contact-org",
        managerUserId: setup.data.admin.id,
        phone: "10000000099",
        email: "org@example.com",
        address: "100 Admin Road"
      })
    });
    const created = await createResponse.json();

    const updateResponse = await app.request(`/api/organizations/${created.data.id}`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({
        managerUserId: null,
        phone: "10000000100",
        email: null,
        address: "200 Admin Road"
      })
    });
    const updated = await updateResponse.json();

    expect(createResponse.status).toBe(201);
    expect(created.data).toMatchObject({
      managerUserId: setup.data.admin.id,
      phone: "10000000099",
      email: "org@example.com",
      address: "100 Admin Road"
    });
    expect(updateResponse.status).toBe(200);
    expect(updated.data).toMatchObject({
      managerUserId: null,
      phone: "10000000100",
      email: null,
      address: "200 Admin Road"
    });
  });

  it("rejects organization move attempts through update payloads", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    const childResponse = await app.request("/api/organizations", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        parentOrganizationId: "1",
        name: "No Move Child",
        code: "no-move-child"
      })
    });
    const child = await childResponse.json();
    const alternateRootResponse = await app.request("/api/organizations", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ name: "No Move Root", code: "no-move-root" })
    });
    const alternateRoot = await alternateRootResponse.json();

    const moveResponse = await app.request(`/api/organizations/${child.data.id}`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({
        parentOrganizationId: alternateRoot.data.id,
        name: "Moved Child"
      })
    });
    const move = await moveResponse.json();
    const detailResponse = await app.request(`/api/organizations/${child.data.id}`, {
      headers: authHeaders
    });
    const detail = await detailResponse.json();

    expect(moveResponse.status).toBe(400);
    expect(move.error.code).toBe("VALIDATION_INVALID_REQUEST");
    expect(detail.data).toMatchObject({
      id: child.data.id,
      name: "No Move Child",
      level: 2,
      segment: child.data.segment,
      path: child.data.path
    });
  });

  it("rejects organization manager references to missing or soft-deleted users", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    const organizationResponse = await app.request("/api/organizations", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        parentOrganizationId: "1",
        name: "Manager Guard",
        code: "manager-guard"
      })
    });
    const organization = await organizationResponse.json();
    const userResponse = await app.request("/api/users", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        username: "deleted-manager",
        displayName: "Deleted Manager",
        email: "deleted-manager@example.com",
        phone: "10000000024",
        password: "password1",
        primaryOrganizationId: "1",
        roleId: "3"
      })
    });
    const user = await userResponse.json();
    await app.request(`/api/users/${user.data.id}`, {
      method: "DELETE",
      headers: authHeaders
    });

    const missingCreateResponse = await app.request("/api/organizations", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        parentOrganizationId: "1",
        name: "Missing Manager",
        code: "missing-manager",
        managerUserId: "999"
      })
    });
    const missingCreate = await missingCreateResponse.json();
    const deletedUpdateResponse = await app.request(`/api/organizations/${organization.data.id}`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ managerUserId: user.data.id })
    });
    const deletedUpdate = await deletedUpdateResponse.json();

    expect(missingCreateResponse.status).toBe(404);
    expect(missingCreate.error.code).toBe("USER_NOT_FOUND");
    expect(deletedUpdateResponse.status).toBe(404);
    expect(deletedUpdate.error.code).toBe("USER_NOT_FOUND");
  });

  it("configures organization maximum depth within the supported 8-level path limit", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    const configResponse = await app.request("/api/organizations/config/depth", {
      headers: authHeaders
    });
    const config = await configResponse.json();
    const updateResponse = await app.request("/api/organizations/config/depth", {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ maxDepth: 2 })
    });
    const update = await updateResponse.json();
    const invalidResponse = await app.request("/api/organizations/config/depth", {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ maxDepth: 9 })
    });
    const invalid = await invalidResponse.json();
    const childResponse = await app.request("/api/organizations", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ parentOrganizationId: "1", name: "Depth Child", code: "depth-child" })
    });
    const child = await childResponse.json();
    const tooDeepResponse = await app.request("/api/organizations", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        parentOrganizationId: child.data.id,
        name: "Too Deep",
        code: "too-deep"
      })
    });
    const tooDeep = await tooDeepResponse.json();

    expect(configResponse.status).toBe(200);
    expect(config.data).toEqual({ maxDepth: 8, maxSupportedDepth: 8 });
    expect(updateResponse.status).toBe(200);
    expect(update.data).toEqual({ maxDepth: 2, maxSupportedDepth: 8 });
    expect(invalidResponse.status).toBe(400);
    expect(invalid.error.code).toBe("VALIDATION_INVALID_REQUEST");
    expect(childResponse.status).toBe(201);
    expect(tooDeepResponse.status).toBe(409);
    expect(tooDeep.error.code).toBe("BUSINESS_MAX_ORG_DEPTH_EXCEEDED");
  });

  it("logs in through another enabled organization when the primary organization is disabled", async () => {
    const { app, setup } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    const alternateResponse = await app.request("/api/organizations", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ name: "Alternate Root", code: "alternate-root" })
    });
    const alternate = await alternateResponse.json();
    await app.request(`/api/users/${setup.data.admin.id}/organizations`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ organizationId: alternate.data.id, roleId: "1" })
    });
    await app.request("/api/organizations/1/disable", {
      method: "POST",
      headers: authHeaders
    });

    const loginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "admin", password: "password1" })
    });
    const login = await loginResponse.json();

    expect(loginResponse.status).toBe(200);
    expect(login.data.session.currentOrganizationId).toBe(alternate.data.id);
  });

  it("logs in through another enabled organization when the primary organization is soft deleted", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    const primaryResponse = await app.request("/api/organizations", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ parentOrganizationId: "1", name: "Deleted Primary", code: "deleted-primary" })
    });
    const primary = await primaryResponse.json();
    const alternateResponse = await app.request("/api/organizations", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ parentOrganizationId: "1", name: "Deleted Fallback", code: "deleted-fallback" })
    });
    const alternate = await alternateResponse.json();
    const userResponse = await app.request("/api/users", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        username: "primary-deleted-user",
        displayName: "Primary Deleted User",
        email: "primary-deleted-user@example.com",
        phone: "10000000021",
        password: "password1",
        primaryOrganizationId: primary.data.id,
        roleId: "3"
      })
    });
    const user = await userResponse.json();
    await app.request(`/api/users/${user.data.id}/organizations`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ organizationId: alternate.data.id, roleId: "3" })
    });
    await app.request(`/api/organizations/${primary.data.id}`, {
      method: "DELETE",
      headers: authHeaders
    });

    const loginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "primary-deleted-user", password: "password1" })
    });
    const login = await loginResponse.json();

    expect(loginResponse.status).toBe(200);
    expect(login.data.session.currentOrganizationId).toBe(alternate.data.id);
    expect(login.data.currentOrganization.id).toBe(alternate.data.id);
  });

  it("denies login when the user has no enabled organization", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    await app.request("/api/organizations/1/disable", {
      method: "POST",
      headers: authHeaders
    });

    const loginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "admin", password: "password1" })
    });
    const login = await loginResponse.json();

    expect(loginResponse.status).toBe(403);
    expect(login.error.code).toBe("BUSINESS_NO_ENABLED_ORGANIZATION");
  });

  it("rejects organization updates that would duplicate organization code", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    const childResponse = await app.request("/api/organizations", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ parentOrganizationId: "1", name: "Child", code: "child" })
    });
    const child = await childResponse.json();

    const response = await app.request(`/api/organizations/${child.data.id}`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ code: "default" })
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("VALIDATION_DUPLICATE_ORGANIZATION_CODE");
  });

  it("returns stable not-found errors for missing core detail records", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);

    const organizationResponse = await app.request("/api/organizations/999", {
      headers: authHeaders
    });
    const organization = await organizationResponse.json();
    const userResponse = await app.request("/api/users/999", { headers: authHeaders });
    const user = await userResponse.json();
    const roleResponse = await app.request("/api/roles/999", { headers: authHeaders });
    const role = await roleResponse.json();

    expect(organizationResponse.status).toBe(404);
    expect(organization.error.code).toBe("ORGANIZATION_NOT_FOUND");
    expect(userResponse.status).toBe(404);
    expect(user.error.code).toBe("USER_NOT_FOUND");
    expect(roleResponse.status).toBe(404);
    expect(role.error.code).toBe("ROLE_NOT_FOUND");
  });

  it("returns paged user and role lists when pagination query parameters are provided", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    await app.request("/api/users", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        username: "paged-user",
        displayName: "Paged User",
        email: "paged-user@example.com",
        phone: "10000000100",
        password: "password1",
        primaryOrganizationId: "1",
        roleId: "3"
      })
    });

    const usersResponse = await app.request("/api/users?page=1&pageSize=1", {
      headers: authHeaders
    });
    const users = await usersResponse.json();
    const rolesResponse = await app.request("/api/roles?page=2&pageSize=1", {
      headers: authHeaders
    });
    const roles = await rolesResponse.json();

    expect(usersResponse.status).toBe(200);
    expect(users.data).toMatchObject({
      page: 1,
      pageSize: 1,
      total: 2,
      totalPages: 2
    });
    expect(users.data.items).toHaveLength(1);
    expect(users.data.items[0].id).toBe("1");
    expect(rolesResponse.status).toBe(200);
    expect(roles.data).toMatchObject({
      page: 2,
      pageSize: 1,
      total: 3,
      totalPages: 3
    });
    expect(roles.data.items).toHaveLength(1);
    expect(roles.data.items[0].id).toBe("2");
  });

  it("returns default paged envelopes for user and role lists without pagination parameters", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);

    const usersResponse = await app.request("/api/users", { headers: authHeaders });
    const users = await usersResponse.json();
    const rolesResponse = await app.request("/api/roles", { headers: authHeaders });
    const roles = await rolesResponse.json();

    expect(usersResponse.status).toBe(200);
    expect(users.data).toMatchObject({
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1
    });
    expect(users.data.items).toEqual([
      expect.objectContaining({ id: "1", username: "admin" })
    ]);
    expect(rolesResponse.status).toBe(200);
    expect(roles.data).toMatchObject({
      page: 1,
      pageSize: 20,
      total: 3,
      totalPages: 1
    });
    expect(roles.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "1", code: "super_admin" }),
        expect.objectContaining({ id: "2", code: "organization_admin" }),
        expect.objectContaining({ id: "3", code: "normal_user" })
      ])
    );
  });

  it("filters the user list by keyword, status, and organization", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    const childResponse = await app.request("/api/organizations", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ parentOrganizationId: "1", name: "Filter Child", code: "filter-child" })
    });
    const child = await childResponse.json();
    const createResponse = await app.request("/api/users", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        username: "filtered-user",
        displayName: "Filtered User",
        email: "filtered-user@example.com",
        phone: "10000000101",
        password: "password1",
        primaryOrganizationId: child.data.id,
        roleId: "3"
      })
    });
    const created = await createResponse.json();
    await app.request(`/api/users/${created.data.id}/disable`, {
      method: "POST",
      headers: authHeaders
    });

    const response = await app.request(
      `/api/users?keyword=filtered&status=disabled&organizationId=${child.data.id}&page=1&pageSize=10`,
      { headers: authHeaders }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      page: 1,
      pageSize: 10,
      total: 1,
      totalPages: 1
    });
    expect(body.data.items).toEqual([
      expect.objectContaining({
        id: created.data.id,
        username: "filtered-user",
        status: "disabled",
        primaryOrganizationId: child.data.id
      })
    ]);
  });

  it("filters the role list by keyword and status", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    const createResponse = await app.request("/api/roles", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        name: "Filtered Role",
        code: "filtered_role",
        description: "Role list filter target"
      })
    });
    const created = await createResponse.json();
    await app.request(`/api/roles/${created.data.id}/disable`, {
      method: "POST",
      headers: authHeaders
    });

    const response = await app.request(
      "/api/roles?keyword=filter%20target&status=disabled&page=1&pageSize=10",
      { headers: authHeaders }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      page: 1,
      pageSize: 10,
      total: 1,
      totalPages: 1
    });
    expect(body.data.items).toEqual([
      expect.objectContaining({
        id: created.data.id,
        code: "filtered_role",
        status: "disabled"
      })
    ]);
  });

  it("rejects invalid user and role list query parameters", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);

    const userStatusResponse = await app.request("/api/users?status=archived", {
      headers: authHeaders
    });
    const userStatus = await userStatusResponse.json();
    const userPageResponse = await app.request("/api/users?page=0", {
      headers: authHeaders
    });
    const userPage = await userPageResponse.json();
    const roleStatusResponse = await app.request("/api/roles?status=locked", {
      headers: authHeaders
    });
    const roleStatus = await roleStatusResponse.json();
    const rolePageResponse = await app.request("/api/roles?pageSize=0", {
      headers: authHeaders
    });
    const rolePage = await rolePageResponse.json();

    expect(userStatusResponse.status).toBe(400);
    expect(userStatus.error.code).toBe("VALIDATION_INVALID_REQUEST");
    expect(userPageResponse.status).toBe(400);
    expect(userPage.error.code).toBe("VALIDATION_INVALID_REQUEST");
    expect(roleStatusResponse.status).toBe(400);
    expect(roleStatus.error.code).toBe("VALIDATION_INVALID_REQUEST");
    expect(rolePageResponse.status).toBe(400);
    expect(rolePage.error.code).toBe("VALIDATION_INVALID_REQUEST");
  });

  it("resets a user password and increments user token version", async () => {
    const { app, setup } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    const resetResponse = await app.request(`/api/users/${setup.data.admin.id}/reset-password`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ password: "password2" })
    });
    const reset = await resetResponse.json();

    expect(reset.data.tokenVersion).toBe(1);
    expect(reset.data.firstLoginPasswordChangeRequired).toBe(true);
  });

  it("rejects administrator password resets that violate the password policy", async () => {
    const { app, setup } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);

    const response = await app.request(`/api/users/${setup.data.admin.id}/reset-password`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ password: "password" })
    });
    const body = await response.json();
    const unchangedResponse = await app.request(`/api/users/${setup.data.admin.id}`, {
      headers: authHeaders
    });
    const unchanged = await unchangedResponse.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("PASSWORD_REQUIRES_NUMBER");
    expect(unchanged.data.tokenVersion).toBe(0);
    expect(unchanged.data.firstLoginPasswordChangeRequired).toBe(false);
  });

  it("creates and updates optional user profile fields", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    const createResponse = await app.request("/api/users", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        username: "profile-user",
        displayName: "Profile User",
        email: "profile-user@example.com",
        phone: "10000000013",
        avatarFileId: "99",
        gender: "unspecified",
        employeeNumber: "EMP-001",
        password: "password1",
        primaryOrganizationId: "1",
        roleId: "3"
      })
    });
    const created = await createResponse.json();

    const updateResponse = await app.request(`/api/users/${created.data.id}`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({
        avatarFileId: null,
        gender: null,
        employeeNumber: "EMP-002"
      })
    });
    const updated = await updateResponse.json();

    expect(createResponse.status).toBe(201);
    expect(created.data).toMatchObject({
      avatarFileId: "99",
      gender: "unspecified",
      employeeNumber: "EMP-001"
    });
    expect(updateResponse.status).toBe(200);
    expect(updated.data).toMatchObject({
      avatarFileId: null,
      gender: null,
      employeeNumber: "EMP-002"
    });
  });

  it("prevents login for administrator-locked users until unlocked", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);

    const createResponse = await app.request("/api/users", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        username: "locked-user",
        displayName: "Locked User",
        email: "locked-user@example.com",
        phone: "10000000005",
        password: "password1",
        primaryOrganizationId: "1",
        roleId: "3"
      })
    });
    const created = await createResponse.json();

    await app.request(`/api/users/${created.data.id}/lock`, {
      method: "POST",
      headers: authHeaders
    });
    const lockedLoginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "locked-user", password: "password1" })
    });
    const lockedLogin = await lockedLoginResponse.json();

    await app.request(`/api/users/${created.data.id}/unlock`, {
      method: "POST",
      headers: authHeaders
    });
    const unlockedLoginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "locked-user", password: "password1" })
    });

    expect(lockedLoginResponse.status).toBe(423);
    expect(lockedLogin.error.code).toBe("AUTH_ACCOUNT_LOCKED");
    expect(unlockedLoginResponse.status).toBe(200);
  });

  it("rejects user updates that would duplicate username, email, or phone", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);

    await app.request("/api/users", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        username: "first-user",
        displayName: "First User",
        email: "first-user@example.com",
        phone: "10000000006",
        password: "password1",
        primaryOrganizationId: "1",
        roleId: "3"
      })
    });
    const secondResponse = await app.request("/api/users", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        username: "second-user",
        displayName: "Second User",
        email: "second-user@example.com",
        phone: "10000000007",
        password: "password1",
        primaryOrganizationId: "1",
        roleId: "3"
      })
    });
    const second = await secondResponse.json();

    const duplicateUsernameResponse = await app.request(`/api/users/${second.data.id}`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ username: "first-user" })
    });
    const duplicateUsername = await duplicateUsernameResponse.json();
    const duplicateEmailResponse = await app.request(`/api/users/${second.data.id}`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ email: "first-user@example.com" })
    });
    const duplicateEmail = await duplicateEmailResponse.json();
    const duplicatePhoneResponse = await app.request(`/api/users/${second.data.id}`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ phone: "10000000006" })
    });
    const duplicatePhone = await duplicatePhoneResponse.json();

    expect(duplicateUsernameResponse.status).toBe(409);
    expect(duplicateUsername.error.code).toBe("VALIDATION_DUPLICATE_USERNAME");
    expect(duplicateEmailResponse.status).toBe(409);
    expect(duplicateEmail.error.code).toBe("VALIDATION_DUPLICATE_EMAIL");
    expect(duplicatePhoneResponse.status).toBe(409);
    expect(duplicatePhone.error.code).toBe("VALIDATION_DUPLICATE_PHONE");
  });

  it("rejects updating a user's primary organization to a disabled organization", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    const childResponse = await app.request("/api/organizations", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ parentOrganizationId: "1", name: "Child", code: "child" })
    });
    const child = await childResponse.json();
    await app.request(`/api/organizations/${child.data.id}/disable`, {
      method: "POST",
      headers: authHeaders
    });

    const response = await app.request("/api/users/1", {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ primaryOrganizationId: child.data.id })
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("BUSINESS_ORG_DISABLED");
  });

  it("rejects creating users and role bindings under a disabled organization", async () => {
    const { app, setup } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    const childResponse = await app.request("/api/organizations", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ parentOrganizationId: "1", name: "Disabled Child", code: "disabled-child" })
    });
    const child = await childResponse.json();
    await app.request(`/api/organizations/${child.data.id}/disable`, {
      method: "POST",
      headers: authHeaders
    });

    const createUserResponse = await app.request("/api/users", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        username: "disabled-org-user",
        displayName: "Disabled Org User",
        email: "disabled-org-user@example.com",
        phone: "10000000123",
        password: "password1",
        primaryOrganizationId: child.data.id,
        roleId: "3"
      })
    });
    const createUser = await createUserResponse.json();
    const assignResponse = await app.request(`/api/users/${setup.data.admin.id}/organizations`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ organizationId: child.data.id, roleId: "2" })
    });
    const assign = await assignResponse.json();

    expect(createUserResponse.status).toBe(409);
    expect(createUser.error.code).toBe("BUSINESS_ORG_DISABLED");
    expect(assignResponse.status).toBe(409);
    expect(assign.error.code).toBe("BUSINESS_ORG_DISABLED");
  });

  it("rejects creating child organizations under a disabled parent organization", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    const parentResponse = await app.request("/api/organizations", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        parentOrganizationId: "1",
        name: "Disabled Parent",
        code: "disabled-parent"
      })
    });
    const parent = await parentResponse.json();

    await app.request(`/api/organizations/${parent.data.id}/disable`, {
      method: "POST",
      headers: authHeaders
    });
    const childResponse = await app.request("/api/organizations", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        parentOrganizationId: parent.data.id,
        name: "Rejected Child",
        code: "rejected-child"
      })
    });
    const child = await childResponse.json();

    expect(childResponse.status).toBe(409);
    expect(child.error.code).toBe("BUSINESS_ORG_DISABLED");
  });

  it("rejects creating users and role bindings with a disabled role", async () => {
    const { app, setup } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    const childResponse = await app.request("/api/organizations", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ parentOrganizationId: "1", name: "Role Child", code: "role-child" })
    });
    const child = await childResponse.json();
    await app.request("/api/roles/3/disable", {
      method: "POST",
      headers: authHeaders
    });

    const createUserResponse = await app.request("/api/users", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        username: "disabled-role-user",
        displayName: "Disabled Role User",
        email: "disabled-role-user@example.com",
        phone: "10000000124",
        password: "password1",
        primaryOrganizationId: child.data.id,
        roleId: "3"
      })
    });
    const createUser = await createUserResponse.json();
    const assignResponse = await app.request(`/api/users/${setup.data.admin.id}/organizations`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ organizationId: child.data.id, roleId: "3" })
    });
    const assign = await assignResponse.json();

    expect(createUserResponse.status).toBe(409);
    expect(createUser.error.code).toBe("BUSINESS_ROLE_DISABLED");
    expect(assignResponse.status).toBe(409);
    expect(assign.error.code).toBe("BUSINESS_ROLE_DISABLED");
  });

  it("rejects updating a user's primary organization to an unbound organization", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    const childResponse = await app.request("/api/organizations", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ parentOrganizationId: "1", name: "Child", code: "child" })
    });
    const child = await childResponse.json();

    const response = await app.request("/api/users/1", {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ primaryOrganizationId: child.data.id })
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_INVALID_REQUEST");
  });

  it("rejects updating a user's primary organization through a disabled role binding", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    const childResponse = await app.request("/api/organizations", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ parentOrganizationId: "1", name: "Disabled Primary Role", code: "disabled-primary-role" })
    });
    const child = await childResponse.json();
    const userResponse = await app.request("/api/users", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        username: "disabled-primary-role-user",
        displayName: "Disabled Primary Role User",
        email: "disabled-primary-role-user@example.com",
        phone: "10000000140",
        password: "password1",
        primaryOrganizationId: "1",
        roleId: "3"
      })
    });
    const user = await userResponse.json();
    await app.request(`/api/users/${user.data.id}/organizations`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ organizationId: child.data.id, roleId: "2" })
    });
    await app.request("/api/roles/2/disable", {
      method: "POST",
      headers: authHeaders
    });

    const response = await app.request(`/api/users/${user.data.id}`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ primaryOrganizationId: child.data.id })
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_INVALID_REQUEST");
  });

  it("uses the updated primary organization on the next login", async () => {
    const services = createInMemoryBackendCoreServices();
    const { app } = await setupInitializedApp(createApp({ backendCoreServices: services }));
    const { authHeaders } = await loginAsAdmin(app);
    const childResponse = await app.request("/api/organizations", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ parentOrganizationId: "1", name: "Primary Child", code: "primary-child" })
    });
    const child = await childResponse.json();
    await app.request("/api/roles/2/permissions", {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ permissionCodes: ["organization:view"] })
    });
    const organizationGrant = services["context"].store.rolePermissions.find(
      (permission) => permission.roleId === "2" && permission.permissionCode === "organization:view"
    );
    if (!organizationGrant) throw new Error("Expected organization:view role grant to exist");
    services["context"].store.rolePermissions.push({ ...organizationGrant });
    const userResponse = await app.request("/api/users", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        username: "primary-update-user",
        displayName: "Primary Update User",
        email: "primary-update-user@example.com",
        phone: "10000000125",
        password: "password1",
        primaryOrganizationId: "1",
        roleId: "3"
      })
    });
    const user = await userResponse.json();
    await app.request(`/api/users/${user.data.id}/organizations`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ organizationId: child.data.id, roleId: "2" })
    });

    const updateResponse = await app.request(`/api/users/${user.data.id}`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ primaryOrganizationId: child.data.id })
    });
    const update = await updateResponse.json();
    const bindingsResponse = await app.request(`/api/users/${user.data.id}/organizations`, {
      headers: authHeaders
    });
    const bindings = await bindingsResponse.json();
    const loginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "primary-update-user", password: "password1" })
    });
    const login = await loginResponse.json();

    expect(updateResponse.status).toBe(200);
    expect(update.data.primaryOrganizationId).toBe(child.data.id);
    expect(bindings.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ organizationId: "1", isPrimary: false }),
        expect.objectContaining({ organizationId: child.data.id, isPrimary: true })
      ])
    );
    expect(loginResponse.status).toBe(200);
    expect(login.data.currentOrganization.id).toBe(child.data.id);
    expect(login.data.permissionCodes).toEqual(["organization:view"]);
  });

  it("locks accounts according to the configured failed-login policy", async () => {
    const services = createInMemoryBackendCoreServices({
      failedLoginMaxAttempts: 2,
      failedLoginLockMinutes: 30
    });
    const { app } = await setupInitializedApp(createApp({ backendCoreServices: services }));
    const originalAdmin = services.getUser("1");

    await new Promise((resolve) => setTimeout(resolve, 5));
    await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "admin", password: "wrong-password" })
    });
    await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "admin", password: "wrong-password" })
    });
    const lockedLoginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "admin", password: "password1" })
    });
    const lockedLogin = await lockedLoginResponse.json();
    const lockedAdmin = services.getUser("1");

    expect(lockedLoginResponse.status).toBe(423);
    expect(lockedLogin.error.code).toBe("AUTH_ACCOUNT_LOCKED");
    expect(lockedAdmin.failedLoginAttempts).toBe(2);
    expect(lockedAdmin.status).toBe("locked");
    expect(lockedAdmin.lockedUntil).toEqual(expect.any(String));
    expect(new Date(lockedAdmin.updatedAt).getTime()).toBeGreaterThan(
      new Date(originalAdmin.updatedAt).getTime()
    );
  });

  it("invalidates existing sessions when the failed-login policy locks an account", async () => {
    const services = createInMemoryBackendCoreServices({
      failedLoginMaxAttempts: 2,
      failedLoginLockMinutes: 30
    });
    const { app } = await setupInitializedApp(createApp({ backendCoreServices: services }));
    const { authHeaders } = await loginAsAdmin(app);
    await app.request("/api/users", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        username: "failed-lock-session-user",
        displayName: "Failed Lock Session User",
        email: "failed-lock-session-user@example.com",
        phone: "10000000024",
        password: "password1",
        primaryOrganizationId: "1",
        roleId: "3"
      })
    });
    const firstLoginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "failed-lock-session-user", password: "password1" })
    });
    const firstLogin = await firstLoginResponse.json();
    await app.request("/api/auth/change-password", {
      method: "POST",
      headers: { authorization: `Bearer ${firstLogin.data.accessToken}` },
      body: JSON.stringify({ oldPassword: "password1", newPassword: "password2" })
    });
    const loginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "failed-lock-session-user", password: "password2" })
    });
    const login = await loginResponse.json();
    const cookie = loginResponse.headers.get("set-cookie") ?? "";

    await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "failed-lock-session-user", password: "wrong-password" })
    });
    await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "failed-lock-session-user", password: "wrong-password" })
    });
    const lockedUser = services.getUser(login.data.user.id);
    const oldAccessResponse = await app.request("/api/auth/me", {
      headers: { authorization: `Bearer ${login.data.accessToken}` }
    });
    const oldAccess = await oldAccessResponse.json();
    const oldRefreshResponse = await app.request("/api/auth/refresh", {
      method: "POST",
      headers: { cookie: cookie.split(";")[0] }
    });
    const oldRefresh = await oldRefreshResponse.json();
    const onlineUsersResponse = await app.request("/api/online-users", { headers: authHeaders });
    const onlineUsers = await onlineUsersResponse.json();

    expect(lockedUser).toMatchObject({
      status: "locked",
      failedLoginAttempts: 2,
      tokenVersion: login.data.user.tokenVersion + 1
    });
    expect(oldAccessResponse.status).toBe(401);
    expect(oldAccess.error.code).toBe("AUTH_TOKEN_INVALIDATED");
    expect(oldRefreshResponse.status).toBe(423);
    expect(oldRefresh.error.code).toBe("AUTH_ACCOUNT_LOCKED");
    expect(onlineUsers.data).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ userId: login.data.user.id })])
    );
  });

  it("clears expired timed failed-login locks before counting new failures", async () => {
    const services = createInMemoryBackendCoreServices({
      failedLoginMaxAttempts: 2,
      failedLoginLockMinutes: 0
    });
    const { app } = await setupInitializedApp(createApp({ backendCoreServices: services }));

    await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "admin", password: "wrong-password" })
    });
    await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "admin", password: "wrong-password" })
    });
    const lockedAdmin = services.getUser("1");
    const nextFailureResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "admin", password: "wrong-password" })
    });
    const nextFailure = await nextFailureResponse.json();
    const unlockedAdmin = services.getUser("1");

    expect(lockedAdmin.status).toBe("locked");
    expect(lockedAdmin.lockedUntil).toEqual(expect.any(String));
    expect(nextFailureResponse.status).toBe(401);
    expect(nextFailure.error.code).toBe("AUTH_INVALID_CREDENTIALS");
    expect(unlockedAdmin.status).toBe("enabled");
    expect(unlockedAdmin.failedLoginAttempts).toBe(1);
    expect(unlockedAdmin.lockedUntil).toBeNull();
  });

  it("updates role permissions from the base permission manifest", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    const response = await app.request("/api/roles/1/permissions", {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ permissionCodes: ["user:view", "role:view"] })
    });
    const role = await response.json();
    const permissionsResponse = await app.request("/api/roles/1/permissions", {
      headers: authHeaders
    });
    const permissions = await permissionsResponse.json();

    expect(role.data.id).toBe("1");
    expect(role.data.updatedBy).toBe("1");
    expect(permissions.data).toEqual(["user:view", "role:view"]);
  });

  it("rejects unknown role permission codes without changing existing grants", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    await app.request("/api/roles/1/permissions", {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ permissionCodes: ["user:view", "role:view"] })
    });

    const response = await app.request("/api/roles/1/permissions", {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ permissionCodes: ["user:view", "not-a-permission"] })
    });
    const body = await response.json();
    const permissionsResponse = await app.request("/api/roles/1/permissions", {
      headers: authHeaders
    });
    const permissions = await permissionsResponse.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("PERMISSION_UNKNOWN_CODE");
    expect(permissions.data).toEqual(["user:view", "role:view"]);
  });

  it("rejects role permission codes missing from synced permission metadata", async () => {
    const services = createInMemoryBackendCoreServices();
    const { app } = await setupInitializedApp(createApp({ backendCoreServices: services }));
    const { authHeaders } = await loginAsAdmin(app);
    await app.request("/api/roles/1/permissions", {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ permissionCodes: ["user:view", "role:view"] })
    });
    const userViewPermission = services
      .listPermissions()
      .find((permission) => permission.code === "user:view");
    if (!userViewPermission) throw new Error("Expected user:view permission to exist");
    userViewPermission.code = "user:view:stale";

    const response = await app.request("/api/roles/1/permissions", {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ permissionCodes: ["user:view"] })
    });
    const body = await response.json();
    const permissionsResponse = await app.request("/api/roles/1/permissions", {
      headers: authHeaders
    });
    const permissions = await permissionsResponse.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("PERMISSION_UNKNOWN_CODE");
    expect(permissions.data).toEqual(["role:view"]);
  });

  it("syncs permission and API permission manifests", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    const response = await app.request("/api/permissions/sync", {
      method: "POST",
      headers: authHeaders
    });
    const body = await response.json();
    const secondResponse = await app.request("/api/permissions/sync", {
      method: "POST",
      headers: authHeaders
    });
    const secondBody = await secondResponse.json();
    const apiListResponse = await app.request("/api/permissions/api", { headers: authHeaders });
    const apiList = await apiListResponse.json();
    const apiSyncResponse = await app.request("/api/permissions/api/sync", {
      method: "POST",
      headers: authHeaders
    });
    const apiSync = await apiSyncResponse.json();

    expect(response.status).toBe(200);
    expect(body.data.permissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: expect.any(String), code: "permission:sync" }),
        expect.objectContaining({ id: expect.any(String), code: "permission:api:sync" })
      ])
    );
    expect(body.data.apiPermissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: expect.any(String), path: "/api/permissions/sync" })
      ])
    );
    expect(secondBody.data.permissions[0].id).toBe(body.data.permissions[0].id);
    expect(secondBody.data.apiPermissions[0].id).toBe(body.data.apiPermissions[0].id);
    expect(apiListResponse.status).toBe(200);
    expect(apiList.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(String),
          code: "api.permissions.api.sync",
          requiredPermission: "permission:api:sync"
        })
      ])
    );
    expect(apiSyncResponse.status).toBe(200);
    expect(apiSync.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(String),
          code: "api.permissions.api.sync",
          path: "/api/permissions/api/sync"
        })
      ])
    );
  });

  it("filters API permission identifiers by keyword and metadata fields", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);

    const response = await app.request(
      "/api/permissions/api?keyword=profile&method=GET&module=auth&status=enabled&public=false",
      { headers: authHeaders }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([
      expect.objectContaining({
        code: "api.auth.me",
        method: "GET",
        path: "/api/auth/me",
        module: "auth",
        status: "enabled",
        public: false
      })
    ]);
  });

  it("filters API permission identifiers by log level metadata", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);

    const response = await app.request("/api/permissions/api?logLevel=none", {
      headers: authHeaders
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([
      expect.objectContaining({
        code: "api.health.view",
        logLevel: "none"
      })
    ]);
  });

  it("returns paged API permission identifiers when pagination query parameters are provided", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);

    const response = await app.request("/api/permissions/api?module=users&page=1&pageSize=2", {
      headers: authHeaders
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      page: 1,
      pageSize: 2,
      total: expect.any(Number),
      totalPages: expect.any(Number)
    });
    expect(body.data.total).toBeGreaterThanOrEqual(2);
    expect(body.data.items).toHaveLength(2);
    expect(body.data.items).toEqual([
      expect.objectContaining({ module: "users" }),
      expect.objectContaining({ module: "users" })
    ]);
  });

  it("rejects invalid API permission identifier filters", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);

    const methodResponse = await app.request("/api/permissions/api?method=TRACE", {
      headers: authHeaders
    });
    const methodBody = await methodResponse.json();
    const publicResponse = await app.request("/api/permissions/api?public=maybe", {
      headers: authHeaders
    });
    const publicBody = await publicResponse.json();
    const logLevelResponse = await app.request("/api/permissions/api?logLevel=verbose", {
      headers: authHeaders
    });
    const logLevelBody = await logLevelResponse.json();
    const pageResponse = await app.request("/api/permissions/api?page=0", {
      headers: authHeaders
    });
    const pageBody = await pageResponse.json();

    expect(methodResponse.status).toBe(400);
    expect(methodBody.error.code).toBe("VALIDATION_INVALID_REQUEST");
    expect(publicResponse.status).toBe(400);
    expect(publicBody.error.code).toBe("VALIDATION_INVALID_REQUEST");
    expect(logLevelResponse.status).toBe(400);
    expect(logLevelBody.error.code).toBe("VALIDATION_INVALID_REQUEST");
    expect(pageResponse.status).toBe(400);
    expect(pageBody.error.code).toBe("VALIDATION_INVALID_REQUEST");
  });

  it("disables stale base manifest permission metadata on sync", async () => {
    const services = createInMemoryBackendCoreServices();
    const { app } = await setupInitializedApp(createApp({ backendCoreServices: services }));
    const { authHeaders } = await loginAsAdmin(app);
    const store = services["context"].store;
    const now = "2026-01-01T00:00:00.000Z";
    store.permissions.set("999", {
      id: "999",
      tenantId: null,
      code: "obsolete:view",
      name: "obsolete:view",
      permissionType: "action",
      resource: "obsolete",
      action: "view",
      description: "Obsolete permission",
      module: "obsolete",
      source: "base_manifest",
      manifestHash: "obsolete",
      status: "enabled",
      createdAt: now,
      updatedAt: now
    });
    store.apiPermissions.set("999", {
      id: "999",
      tenantId: null,
      method: "GET",
      path: "/api/obsolete",
      code: "api.obsolete.view",
      description: "Obsolete API permission",
      module: "obsolete",
      requiredPermission: "obsolete:view",
      logLevel: "basic",
      public: false,
      status: "enabled",
      createdAt: now,
      updatedAt: now
    });
    const canonicalUsersApiPermission = services
      .listApiPermissions()
      .find((permission) => permission.code === "api.users.list");
    if (!canonicalUsersApiPermission) throw new Error("Expected api.users.list permission");
    store.apiPermissions.delete(canonicalUsersApiPermission.id);
    store.apiPermissions.set("1000", {
      id: "1000",
      tenantId: null,
      method: "GET",
      path: "/api/users",
      code: "api.users.list.legacy",
      description: "Legacy users list API permission",
      module: "users",
      requiredPermission: "user:view",
      logLevel: "basic",
      public: false,
      status: "enabled",
      createdAt: now,
      updatedAt: now
    });
    store.rolePermissions.push({
      roleId: "2",
      permissionCode: "obsolete:view",
      effect: "allow",
      createdAt: now,
      updatedAt: now
    });
    store.menuApiBindings.set("999", {
      id: "999",
      tenantId: null,
      menuId: "2",
      apiPermissionId: "999",
      createdAt: now
    });

    const syncResponse = await app.request("/api/permissions/sync", {
      method: "POST",
      headers: authHeaders
    });
    const stalePermission = services
      .listPermissions()
      .find((permission) => permission.code === "obsolete:view");
    const staleApiPermission = services
      .listApiPermissions()
      .find((permission) => permission.code === "api.obsolete.view");
    const reconciledUsersApiPermissions = services
      .listApiPermissions()
      .filter((permission) => permission.method === "GET" && permission.path === "/api/users");
    const roleUpdateResponse = await app.request("/api/roles/1/permissions", {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ permissionCodes: ["obsolete:view"] })
    });
    const roleUpdate = await roleUpdateResponse.json();
    const configuredResponse = await app.request("/api/roles/2/permissions", {
      headers: authHeaders
    });
    const configured = await configuredResponse.json();
    const staleMenuApiBinding = [...store.menuApiBindings.values()].find(
      (binding) => binding.apiPermissionId === "999"
    );

    expect(syncResponse.status).toBe(200);
    expect(stalePermission).toMatchObject({ status: "disabled" });
    expect(staleApiPermission).toMatchObject({ status: "disabled" });
    expect(staleMenuApiBinding).toBeUndefined();
    expect(reconciledUsersApiPermissions).toEqual([
      expect.objectContaining({
        id: "1000",
        code: "api.users.list",
        status: "enabled"
      })
    ]);
    expect(roleUpdateResponse.status).toBe(400);
    expect(roleUpdate.error.code).toBe("PERMISSION_UNKNOWN_CODE");
    expect(configured.data).not.toContain("obsolete:view");
  });

  it("lists initialized permission records with API JSON string ids", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);

    const response = await app.request("/api/permissions", { headers: authHeaders });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(String),
          code: "user:view",
          permissionType: "action",
          resource: "user",
          action: "view",
          source: "base_manifest",
          manifestHash: expect.stringMatching(/^[a-f0-9]{64}$/),
          status: "enabled"
        })
      ])
    );
  });

  it("filters initialized permission records by confirmed metadata fields", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);

    const response = await app.request(
      "/api/permissions?keyword=users&module=users&resource=user&action=view&type=action&source=base_manifest&status=enabled",
      { headers: authHeaders }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([
      expect.objectContaining({
        code: "user:view",
        module: "users",
        resource: "user",
        action: "view",
        permissionType: "action",
        source: "base_manifest",
        status: "enabled"
      })
    ]);
  });

  it("returns paged initialized permission records when pagination query parameters are provided", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);

    const response = await app.request("/api/permissions?module=users&page=2&pageSize=3", {
      headers: authHeaders
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      page: 2,
      pageSize: 3,
      total: 9,
      totalPages: 3
    });
    expect(body.data.items).toEqual([
      expect.objectContaining({ code: "user:disable" }),
      expect.objectContaining({ code: "user:enable" }),
      expect.objectContaining({ code: "user:lock" })
    ]);
  });

  it("rejects invalid initialized permission record filters", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);

    const statusResponse = await app.request("/api/permissions?status=archived", {
      headers: authHeaders
    });
    const statusBody = await statusResponse.json();
    const typeResponse = await app.request("/api/permissions?type=button", {
      headers: authHeaders
    });
    const typeBody = await typeResponse.json();
    const pageResponse = await app.request("/api/permissions?pageSize=0", {
      headers: authHeaders
    });
    const pageBody = await pageResponse.json();

    expect(statusResponse.status).toBe(400);
    expect(statusBody.error.code).toBe("VALIDATION_INVALID_REQUEST");
    expect(typeResponse.status).toBe(400);
    expect(typeBody.error.code).toBe("VALIDATION_INVALID_REQUEST");
    expect(pageResponse.status).toBe(400);
    expect(pageBody.error.code).toBe("VALIDATION_INVALID_REQUEST");
  });

  it("reads role permission codes", async () => {
    const services = createInMemoryBackendCoreServices();
    const { app } = await setupInitializedApp(createApp({ backendCoreServices: services }));
    const { authHeaders } = await loginAsAdmin(app);
    await app.request("/api/roles/2/permissions", {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ permissionCodes: ["user:view", "role:view", "user:view"] })
    });
    const { store } = (services as unknown as {
      context: {
        store: {
          rolePermissions: Array<{
            roleId: string;
            permissionCode: string;
            effect: "allow" | "deny";
            createdAt: string;
            updatedAt: string;
          }>;
        };
      };
    }).context;
    const duplicateGrant = store.rolePermissions.find(
      (permission) => permission.roleId === "2" && permission.permissionCode === "user:view"
    );
    if (!duplicateGrant) throw new Error("Expected role grant to exist");
    store.rolePermissions.push({ ...duplicateGrant });

    const response = await app.request("/api/roles/2/permissions", {
      headers: authHeaders
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual(["user:view", "role:view"]);
  });

  it("creates, updates, and soft deletes managed menus", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    const createResponse = await app.request("/api/menus", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        parentMenuId: "2",
        code: "system.audit",
        titleI18nKey: "routes.system.audit",
        path: "/system/audit",
        requiredPermission: "menu:view",
        sortOrder: 150,
        visible: false
      })
    });
    const created = await createResponse.json();
    const hiddenContextResponse = await app.request("/api/auth/me", { headers: authHeaders });
    const hiddenContext = await hiddenContextResponse.json();
    const treeResponse = await app.request("/api/menus/tree", { headers: authHeaders });
    const tree = await treeResponse.json();

    const updateResponse = await app.request(`/api/menus/${created.data.id}`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({
        titleI18nKey: "routes.system.auditLogs",
        visible: true,
        status: "disabled"
      })
    });
    const updated = await updateResponse.json();
    const contextResponse = await app.request("/api/auth/me", { headers: authHeaders });
    const context = await contextResponse.json();
    const deleteResponse = await app.request(`/api/menus/${created.data.id}`, {
      method: "DELETE",
      headers: authHeaders
    });
    const deleted = await deleteResponse.json();

    expect(createResponse.status).toBe(201);
    expect(created.data).toMatchObject({
      id: expect.any(String),
      parentMenuId: "2",
      code: "system.audit",
      visible: false
    });
    expect(hiddenContext.data.menus).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "system.audit" })])
    );
    expect(treeResponse.status).toBe(200);
    expect(tree.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "system",
          children: expect.arrayContaining([
            expect.objectContaining({ code: "system.audit", children: [] })
          ])
        })
      ])
    );
    expect(updated.data).toMatchObject({
      titleI18nKey: "routes.system.auditLogs",
      visible: true,
      status: "disabled"
    });
    expect(context.data.menus).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "system.audit" })])
    );
    expect(deleted.data).toMatchObject({
      id: created.data.id,
      isDeleted: true,
      deletedAt: expect.any(String),
      deletedBy: "1"
    });
  });

  it("updates managed menu API permission bindings", async () => {
    const services = createInMemoryBackendCoreServices();
    const { app } = await setupInitializedApp(createApp({ backendCoreServices: services }));
    const { authHeaders } = await loginAsAdmin(app);
    const apiPermissionsResponse = await app.request("/api/permissions/api", {
      headers: authHeaders
    });
    const apiPermissions = await apiPermissionsResponse.json();
    const listUsersApi = apiPermissions.data.find(
      (apiPermission: { code: string }) => apiPermission.code === "api.users.list"
    );
    const createUsersApi = apiPermissions.data.find(
      (apiPermission: { code: string }) => apiPermission.code === "api.users.create"
    );
    const menuResponse = await app.request("/api/menus", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        parentMenuId: "2",
        code: "system.api-bound",
        titleI18nKey: "routes.system.apiBound",
        path: "/system/api-bound",
        requiredPermission: "menu:view"
      })
    });
    const menu = await menuResponse.json();

    const bindResponse = await app.request(`/api/menus/${menu.data.id}/api-bindings`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({
        apiPermissionIds: [listUsersApi.id, createUsersApi.id, listUsersApi.id]
      })
    });
    const bound = await bindResponse.json();
    services["context"].store.apiPermissions.get(createUsersApi.id)!.status = "disabled";
    const disabledResponse = await app.request(`/api/menus/${menu.data.id}/api-bindings`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ apiPermissionIds: [createUsersApi.id] })
    });
    const disabled = await disabledResponse.json();
    const invalidResponse = await app.request(`/api/menus/${menu.data.id}/api-bindings`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ apiPermissionIds: ["999999"] })
    });
    const invalid = await invalidResponse.json();

    expect(apiPermissionsResponse.status).toBe(200);
    expect(menuResponse.status).toBe(201);
    expect(bindResponse.status).toBe(200);
    expect(bound.data).toMatchObject({
      menuId: menu.data.id,
      apiPermissionIds: [listUsersApi.id, createUsersApi.id]
    });
    expect(bound.data.bindings).toEqual([
      expect.objectContaining({
        id: expect.any(String),
        menuId: menu.data.id,
        apiPermissionId: listUsersApi.id,
        createdAt: expect.any(String)
      }),
      expect.objectContaining({
        id: expect.any(String),
        menuId: menu.data.id,
        apiPermissionId: createUsersApi.id,
        createdAt: expect.any(String)
      })
    ]);
    expect(disabledResponse.status).toBe(400);
    expect(disabled.error.code).toBe("VALIDATION_INVALID_REQUEST");
    expect(invalidResponse.status).toBe(400);
    expect(invalid.error.code).toBe("VALIDATION_INVALID_REQUEST");
  });

  it("rejects managed menu parent updates that would create a cycle", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    const parentResponse = await app.request("/api/menus", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        parentMenuId: "2",
        code: "system.parent",
        titleI18nKey: "routes.system.parent",
        path: "/system/parent",
        requiredPermission: "menu:view"
      })
    });
    const parent = await parentResponse.json();
    const childResponse = await app.request("/api/menus", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        parentMenuId: parent.data.id,
        code: "system.parent.child",
        titleI18nKey: "routes.system.parent.child",
        path: "/system/parent/child",
        requiredPermission: "menu:view"
      })
    });
    const child = await childResponse.json();
    const cycleResponse = await app.request(`/api/menus/${parent.data.id}`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ parentMenuId: child.data.id })
    });
    const cycle = await cycleResponse.json();

    expect(parentResponse.status).toBe(201);
    expect(childResponse.status).toBe(201);
    expect(cycleResponse.status).toBe(400);
    expect(cycle.error.code).toBe("VALIDATION_INVALID_REQUEST");
  });

  it("rejects managed menus with unknown permission or route references", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    const unknownPermissionResponse = await app.request("/api/menus", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        parentMenuId: "2",
        code: "system.unknown-permission",
        titleI18nKey: "routes.system.unknownPermission",
        path: "/system/unknown-permission",
        requiredPermission: "unknown:view"
      })
    });
    const unknownPermission = await unknownPermissionResponse.json();
    const unknownRouteResponse = await app.request("/api/menus", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        parentMenuId: "2",
        code: "system.unknown-route",
        titleI18nKey: "routes.system.unknownRoute",
        path: "/system/unknown-route",
        routeCode: "system.unknownRoute"
      })
    });
    const unknownRoute = await unknownRouteResponse.json();
    const createResponse = await app.request("/api/menus", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        parentMenuId: "2",
        code: "system.known-references",
        titleI18nKey: "routes.system.knownReferences",
        path: "/system/known-references",
        requiredPermission: "menu:view",
        routeCode: "system.menus"
      })
    });
    const created = await createResponse.json();
    const updateResponse = await app.request(`/api/menus/${created.data.id}`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ routeCode: "system.missing" })
    });
    const update = await updateResponse.json();

    expect(unknownPermissionResponse.status).toBe(400);
    expect(unknownPermission.error.code).toBe("PERMISSION_UNKNOWN_CODE");
    expect(unknownRouteResponse.status).toBe(400);
    expect(unknownRoute.error.code).toBe("VALIDATION_INVALID_REQUEST");
    expect(createResponse.status).toBe(201);
    expect(updateResponse.status).toBe(400);
    expect(update.error.code).toBe("VALIDATION_INVALID_REQUEST");
  });

  it("rejects managed menus that reference disabled permission metadata", async () => {
    const services = createInMemoryBackendCoreServices();
    const { app } = await setupInitializedApp(createApp({ backendCoreServices: services }));
    const { authHeaders } = await loginAsAdmin(app);
    const menuViewPermission = [...services["context"].store.permissions.values()].find(
      (permission) => permission.code === "menu:view"
    );
    if (!menuViewPermission) throw new Error("Expected seeded menu:view permission");
    menuViewPermission.status = "disabled";

    const createResponse = await app.request("/api/menus", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        parentMenuId: "2",
        code: "system.disabled-permission",
        titleI18nKey: "routes.system.disabledPermission",
        path: "/system/disabled-permission",
        requiredPermission: "menu:view"
      })
    });
    const create = await createResponse.json();
    const updateResponse = await app.request("/api/menus/2", {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ requiredPermission: "menu:view" })
    });
    const update = await updateResponse.json();

    expect(createResponse.status).toBe(400);
    expect(create.error.code).toBe("PERMISSION_UNKNOWN_CODE");
    expect(updateResponse.status).toBe(400);
    expect(update.error.code).toBe("PERMISSION_UNKNOWN_CODE");
  });

  it("rejects managed menus that reference disabled route metadata", async () => {
    const services = createInMemoryBackendCoreServices();
    const { app } = await setupInitializedApp(createApp({ backendCoreServices: services }));
    const { authHeaders } = await loginAsAdmin(app);
    const menuRoute = [...services["context"].store.routeMetadata.values()].find(
      (route) => route.routeCode === "system.menus"
    );
    if (!menuRoute) throw new Error("Expected seeded system.menus route metadata");
    menuRoute.status = "disabled";

    const createResponse = await app.request("/api/menus", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        parentMenuId: "2",
        code: "system.disabled-route",
        titleI18nKey: "routes.system.disabledRoute",
        path: "/system/disabled-route",
        routeCode: "system.menus"
      })
    });
    const create = await createResponse.json();
    const updateResponse = await app.request("/api/menus/2", {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ routeCode: "system.menus" })
    });
    const update = await updateResponse.json();

    expect(createResponse.status).toBe(400);
    expect(create.error.code).toBe("VALIDATION_INVALID_REQUEST");
    expect(updateResponse.status).toBe(400);
    expect(update.error.code).toBe("VALIDATION_INVALID_REQUEST");
  });

  it("soft deletes managed menu descendants with their parent", async () => {
    const services = createInMemoryBackendCoreServices();
    const { app } = await setupInitializedApp(createApp({ backendCoreServices: services }));
    const { authHeaders } = await loginAsAdmin(app);
    const parentResponse = await app.request("/api/menus", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        parentMenuId: "2",
        code: "system.delete-parent",
        titleI18nKey: "routes.system.deleteParent",
        path: "/system/delete-parent",
        requiredPermission: "menu:view"
      })
    });
    const parent = await parentResponse.json();
    const childResponse = await app.request("/api/menus", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        parentMenuId: parent.data.id,
        code: "system.delete-parent.child",
        titleI18nKey: "routes.system.deleteParent.child",
        path: "/system/delete-parent/child",
        requiredPermission: "menu:view"
      })
    });
    const child = await childResponse.json();
    const apiPermission = services
      .listApiPermissions()
      .find((candidate) => candidate.code === "api.users.list");
    if (!apiPermission) throw new Error("Expected api.users.list API permission metadata");
    await app.request(`/api/menus/${parent.data.id}/api-bindings`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ apiPermissionIds: [apiPermission.id] })
    });
    await app.request(`/api/menus/${child.data.id}/api-bindings`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ apiPermissionIds: [apiPermission.id] })
    });
    const deleteResponse = await app.request(`/api/menus/${parent.data.id}`, {
      method: "DELETE",
      headers: authHeaders
    });
    const deleted = await deleteResponse.json();
    const storedMenus = [...services["context"].store.menus.values()];
    const storedBindings = [...services["context"].store.menuApiBindings.values()];
    const treeResponse = await app.request("/api/menus/tree", { headers: authHeaders });
    const tree = await treeResponse.json();

    expect(parentResponse.status).toBe(201);
    expect(childResponse.status).toBe(201);
    expect(deleteResponse.status).toBe(200);
    expect(deleted.data).toMatchObject({
      id: parent.data.id,
      isDeleted: true,
      deletedBy: "1"
    });
    expect(storedMenus).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: parent.data.id,
          isDeleted: true,
          status: "disabled",
          deletedBy: "1"
        }),
        expect.objectContaining({
          id: child.data.id,
          isDeleted: true,
          status: "disabled",
          deletedBy: "1"
        })
      ])
    );
    expect(storedBindings).toEqual([]);
    expect(tree.data).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: parent.data.id }),
        expect.objectContaining({ id: child.data.id })
      ])
    );
    expect(JSON.stringify(tree.data)).not.toContain("system.delete-parent.child");
  });

  it("records the authenticated user on core soft deletes", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);

    const organizationResponse = await app.request("/api/organizations", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        parentOrganizationId: "1",
        name: "Delete Target Organization",
        code: "delete-target-org"
      })
    });
    const organization = await organizationResponse.json();
    const userResponse = await app.request("/api/users", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        username: "delete-target-user",
        displayName: "Delete Target User",
        email: "delete-target-user@example.com",
        phone: "10000000011",
        password: "password1",
        primaryOrganizationId: "1",
        roleId: "3"
      })
    });
    const user = await userResponse.json();
    const roleResponse = await app.request("/api/roles", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        name: "Delete Target Role",
        code: "delete_target_role"
      })
    });
    const role = await roleResponse.json();
    const menuResponse = await app.request("/api/menus", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        parentMenuId: "2",
        code: "system.deleteTarget",
        titleI18nKey: "routes.system.deleteTarget",
        path: "/system/delete-target",
        requiredPermission: "menu:view"
      })
    });
    const menu = await menuResponse.json();

    const deletedOrganizationResponse = await app.request(`/api/organizations/${organization.data.id}`, {
      method: "DELETE",
      headers: authHeaders
    });
    const deletedUserResponse = await app.request(`/api/users/${user.data.id}`, {
      method: "DELETE",
      headers: authHeaders
    });
    const deletedRoleResponse = await app.request(`/api/roles/${role.data.id}`, {
      method: "DELETE",
      headers: authHeaders
    });
    const deletedMenuResponse = await app.request(`/api/menus/${menu.data.id}`, {
      method: "DELETE",
      headers: authHeaders
    });

    await expect(deletedOrganizationResponse.json()).resolves.toMatchObject({
      data: { id: organization.data.id, isDeleted: true, deletedBy: "1" }
    });
    await expect(deletedUserResponse.json()).resolves.toMatchObject({
      data: { id: user.data.id, isDeleted: true, deletedBy: "1" }
    });
    await expect(deletedRoleResponse.json()).resolves.toMatchObject({
      data: { id: role.data.id, isDeleted: true, deletedBy: "1" }
    });
    await expect(deletedMenuResponse.json()).resolves.toMatchObject({
      data: { id: menu.data.id, isDeleted: true, deletedBy: "1" }
    });
  });

  it("soft deletes user organization-role bindings when a user is soft deleted", async () => {
    const services = createInMemoryBackendCoreServices();
    const { app } = await setupInitializedApp(createApp({ backendCoreServices: services }));
    const { authHeaders } = await loginAsAdmin(app);
    const childResponse = await app.request("/api/organizations", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        parentOrganizationId: "1",
        name: "Delete User Child",
        code: "delete-user-child"
      })
    });
    const child = await childResponse.json();
    const userResponse = await app.request("/api/users", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        username: "delete-bindings-user",
        displayName: "Delete Bindings User",
        email: "delete-bindings-user@example.com",
        phone: "10000000042",
        password: "password1",
        primaryOrganizationId: "1",
        roleId: "3"
      })
    });
    const user = await userResponse.json();
    await app.request(`/api/users/${user.data.id}/organizations`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ organizationId: child.data.id, roleId: "2" })
    });

    const deleteResponse = await app.request(`/api/users/${user.data.id}`, {
      method: "DELETE",
      headers: authHeaders
    });
    const bindings = [...services["context"].store.userOrganizationRoles.values()].filter(
      (binding) => binding.userId === user.data.id
    );

    expect(deleteResponse.status).toBe(200);
    expect(bindings).toHaveLength(2);
    expect(bindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ organizationId: "1", isDeleted: true, deletedBy: "1" }),
        expect.objectContaining({ organizationId: child.data.id, isDeleted: true, deletedBy: "1" })
      ])
    );
  });

  it("keeps unique identifiers reserved after soft delete", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    const organizationResponse = await app.request("/api/organizations", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ name: "Reusable Organization", code: "reserved-org" })
    });
    const organization = await organizationResponse.json();
    const userResponse = await app.request("/api/users", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        username: "reserved-user",
        displayName: "Reserved User",
        email: "reserved-user@example.com",
        phone: "15500000001",
        password: "password1",
        primaryOrganizationId: "1",
        roleId: "3"
      })
    });
    const user = await userResponse.json();
    const roleResponse = await app.request("/api/roles", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ name: "Reserved Role", code: "reserved_role" })
    });
    const role = await roleResponse.json();
    const menuResponse = await app.request("/api/menus", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        parentMenuId: "2",
        code: "system.reserved",
        titleI18nKey: "routes.system.reserved",
        path: "/system/reserved"
      })
    });
    const menu = await menuResponse.json();

    await app.request(`/api/organizations/${organization.data.id}`, {
      method: "DELETE",
      headers: authHeaders
    });
    await app.request(`/api/users/${user.data.id}`, {
      method: "DELETE",
      headers: authHeaders
    });
    await app.request(`/api/roles/${role.data.id}`, {
      method: "DELETE",
      headers: authHeaders
    });
    await app.request(`/api/menus/${menu.data.id}`, {
      method: "DELETE",
      headers: authHeaders
    });

    const duplicateOrganizationResponse = await app.request("/api/organizations", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ name: "Duplicate Organization", code: "reserved-org" })
    });
    const duplicateOrganization = await duplicateOrganizationResponse.json();
    const duplicateUserResponse = await app.request("/api/users", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        username: "reserved-user",
        displayName: "Duplicate User",
        email: "duplicate-user@example.com",
        phone: "15500000002",
        password: "password1",
        primaryOrganizationId: "1",
        roleId: "3"
      })
    });
    const duplicateUser = await duplicateUserResponse.json();
    const duplicateRoleResponse = await app.request("/api/roles", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ name: "Duplicate Role", code: "reserved_role" })
    });
    const duplicateRole = await duplicateRoleResponse.json();
    const duplicateMenuResponse = await app.request("/api/menus", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        parentMenuId: "2",
        code: "system.reserved",
        titleI18nKey: "routes.system.reservedDuplicate",
        path: "/system/reserved-duplicate"
      })
    });
    const duplicateMenu = await duplicateMenuResponse.json();

    expect(duplicateOrganizationResponse.status).toBe(409);
    expect(duplicateOrganization.error.code).toBe("VALIDATION_DUPLICATE_ORGANIZATION_CODE");
    expect(duplicateUserResponse.status).toBe(409);
    expect(duplicateUser.error.code).toBe("VALIDATION_DUPLICATE_USERNAME");
    expect(duplicateRoleResponse.status).toBe(409);
    expect(duplicateRole.error.code).toBe("VALIDATION_DUPLICATE_ROLE_CODE");
    expect(duplicateMenuResponse.status).toBe(409);
    expect(duplicateMenu.error.code).toBe("VALIDATION_DUPLICATE_MENU_CODE");
  });

  it("keeps organization path segments reserved after soft delete", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    const firstChildResponse = await app.request("/api/organizations", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        parentOrganizationId: "1",
        name: "Reserved Path Child",
        code: "reserved-path-child"
      })
    });
    const firstChild = await firstChildResponse.json();
    await app.request(`/api/organizations/${firstChild.data.id}`, {
      method: "DELETE",
      headers: authHeaders
    });
    const secondChildResponse = await app.request("/api/organizations", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        parentOrganizationId: "1",
        name: "Replacement Path Child",
        code: "replacement-path-child"
      })
    });
    const secondChild = await secondChildResponse.json();

    expect(firstChildResponse.status).toBe(201);
    expect(secondChildResponse.status).toBe(201);
    expect(secondChild.data.segment).not.toBe(firstChild.data.segment);
    expect(secondChild.data.path).not.toBe(firstChild.data.path);
  });

  it("soft deletes organization descendants with their parent", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    const parentResponse = await app.request("/api/organizations", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        parentOrganizationId: "1",
        name: "Delete Parent Organization",
        code: "delete-parent-org"
      })
    });
    const parent = await parentResponse.json();
    const childResponse = await app.request("/api/organizations", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        parentOrganizationId: parent.data.id,
        name: "Delete Child Organization",
        code: "delete-child-org"
      })
    });
    const child = await childResponse.json();
    const deleteResponse = await app.request(`/api/organizations/${parent.data.id}`, {
      method: "DELETE",
      headers: authHeaders
    });
    const deleted = await deleteResponse.json();
    const treeResponse = await app.request("/api/organizations/tree", { headers: authHeaders });
    const tree = await treeResponse.json();
    const childDetailResponse = await app.request(`/api/organizations/${child.data.id}`, {
      headers: authHeaders
    });
    const childDetail = await childDetailResponse.json();

    expect(parentResponse.status).toBe(201);
    expect(childResponse.status).toBe(201);
    expect(deleteResponse.status).toBe(200);
    expect(deleted.data).toMatchObject({
      id: parent.data.id,
      isDeleted: true,
      deletedBy: "1"
    });
    expect(tree.data).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: parent.data.id }),
        expect.objectContaining({ id: child.data.id })
      ])
    );
    expect(JSON.stringify(tree.data)).not.toContain("delete-child-org");
    expect(childDetailResponse.status).toBe(404);
    expect(childDetail.error.code).toBe("ORGANIZATION_NOT_FOUND");
  });

  it("soft deletes user organization-role bindings under deleted organizations", async () => {
    const services = createInMemoryBackendCoreServices();
    const { app } = await setupInitializedApp(createApp({ backendCoreServices: services }));
    const { authHeaders } = await loginAsAdmin(app);
    const parentResponse = await app.request("/api/organizations", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        parentOrganizationId: "1",
        name: "Binding Delete Parent",
        code: "binding-delete-parent"
      })
    });
    const parent = await parentResponse.json();
    const childResponse = await app.request("/api/organizations", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        parentOrganizationId: parent.data.id,
        name: "Binding Delete Child",
        code: "binding-delete-child"
      })
    });
    const child = await childResponse.json();
    const userResponse = await app.request("/api/users", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        username: "org-delete-binding-user",
        displayName: "Org Delete Binding User",
        email: "org-delete-binding-user@example.com",
        phone: "10000000043",
        password: "password1",
        primaryOrganizationId: "1",
        roleId: "3"
      })
    });
    const user = await userResponse.json();
    await app.request(`/api/users/${user.data.id}/organizations`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ organizationId: parent.data.id, roleId: "2" })
    });
    await app.request(`/api/users/${user.data.id}/organizations`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ organizationId: child.data.id, roleId: "2" })
    });

    const deleteResponse = await app.request(`/api/organizations/${parent.data.id}`, {
      method: "DELETE",
      headers: authHeaders
    });
    const bindings = [...services["context"].store.userOrganizationRoles.values()].filter(
      (binding) => binding.userId === user.data.id
    );

    expect(deleteResponse.status).toBe(200);
    expect(bindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ organizationId: "1", isDeleted: false, status: "enabled" }),
        expect.objectContaining({
          organizationId: parent.data.id,
          isDeleted: true,
          status: "disabled",
          deletedBy: "1"
        }),
        expect.objectContaining({
          organizationId: child.data.id,
          isDeleted: true,
          status: "disabled",
          deletedBy: "1"
        })
      ])
    );
  });

  it("does not include soft-deleted organizations in disable cascade responses", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    const parentResponse = await app.request("/api/organizations", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        parentOrganizationId: "1",
        name: "Disable Parent Organization",
        code: "disable-parent-org"
      })
    });
    const parent = await parentResponse.json();
    const childResponse = await app.request("/api/organizations", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        parentOrganizationId: parent.data.id,
        name: "Deleted Before Disable Child",
        code: "deleted-before-disable-child"
      })
    });
    const child = await childResponse.json();
    await app.request(`/api/organizations/${child.data.id}`, {
      method: "DELETE",
      headers: authHeaders
    });
    const disableResponse = await app.request(`/api/organizations/${parent.data.id}/disable`, {
      method: "POST",
      headers: authHeaders
    });
    const disabled = await disableResponse.json();

    expect(parentResponse.status).toBe(201);
    expect(childResponse.status).toBe(201);
    expect(disableResponse.status).toBe(200);
    expect(disabled.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: parent.data.id })])
    );
    expect(disabled.data).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: child.data.id })])
    );
  });

  it("records authenticated user audit fields on user and organization changes", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);

    const organizationResponse = await app.request("/api/organizations", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        parentOrganizationId: "1",
        name: "Audited Organization",
        code: "audited-org"
      })
    });
    const organization = await organizationResponse.json();
    const organizationUpdateResponse = await app.request(
      `/api/organizations/${organization.data.id}`,
      {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ name: "Audited Organization Updated" })
      }
    );
    const organizationUpdate = await organizationUpdateResponse.json();
    const organizationDisableResponse = await app.request(
      `/api/organizations/${organization.data.id}/disable`,
      { method: "POST", headers: authHeaders }
    );
    const organizationDisable = await organizationDisableResponse.json();

    const userResponse = await app.request("/api/users", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        username: "audited-user",
        displayName: "Audited User",
        email: "audited-user@example.com",
        phone: "10000000012",
        password: "password1",
        primaryOrganizationId: "1",
        roleId: "3"
      })
    });
    const user = await userResponse.json();
    const userUpdateResponse = await app.request(`/api/users/${user.data.id}`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ displayName: "Audited User Updated" })
    });
    const userUpdate = await userUpdateResponse.json();
    const userLockResponse = await app.request(`/api/users/${user.data.id}/lock`, {
      method: "POST",
      headers: authHeaders
    });
    const userLock = await userLockResponse.json();
    const resetResponse = await app.request(`/api/users/${user.data.id}/reset-password`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ password: "password2" })
    });
    const reset = await resetResponse.json();
    const roleResponse = await app.request("/api/roles", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        name: "Audited Role",
        code: "audited_role",
        description: "Audited role description"
      })
    });
    const role = await roleResponse.json();
    const roleUpdateResponse = await app.request(`/api/roles/${role.data.id}`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({
        name: "Audited Role Updated",
        description: "Updated role description"
      })
    });
    const roleUpdate = await roleUpdateResponse.json();
    const roleDisableResponse = await app.request(`/api/roles/${role.data.id}/disable`, {
      method: "POST",
      headers: authHeaders
    });
    const roleDisable = await roleDisableResponse.json();

    expect(organization.data).toMatchObject({ createdBy: "1", updatedBy: "1" });
    expect(organizationUpdate.data).toMatchObject({ updatedBy: "1" });
    expect(organizationDisable.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: organization.data.id, updatedBy: "1" })])
    );
    expect(user.data).toMatchObject({ createdBy: "1", updatedBy: "1" });
    expect(userUpdate.data).toMatchObject({ updatedBy: "1" });
    expect(userLock.data).toMatchObject({ updatedBy: "1" });
    expect(reset.data).toMatchObject({ updatedBy: "1" });
    expect(role.data).toMatchObject({
      createdBy: "1",
      updatedBy: "1",
      description: "Audited role description",
      isBuiltin: false,
      dataScopeRuleId: null
    });
    expect(roleUpdate.data).toMatchObject({
      description: "Updated role description",
      updatedBy: "1"
    });
    expect(roleDisable.data).toMatchObject({ updatedBy: "1" });
  });

  it("serves and syncs route metadata from the base route manifest", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    const manifestResponse = await app.request("/api/routes/manifest", { headers: authHeaders });
    const manifest = await manifestResponse.json();
    const syncResponse = await app.request("/api/routes/sync", {
      method: "POST",
      headers: authHeaders
    });
    const synced = await syncResponse.json();

    expect(manifestResponse.status).toBe(200);
    expect(manifest.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(String),
          routeCode: "system.users",
          requiredPermission: "user:view",
          metadataJson: {
            menuVisible: true,
            icon: null,
            sortOrder: 110
          },
          manifestHash: expect.stringMatching(/^[a-f0-9]{64}$/)
        })
      ])
    );
    expect(syncResponse.status).toBe(200);
    expect(synced.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          routeCode: "system.users",
          metadataJson: {
            menuVisible: true,
            icon: null,
            sortOrder: 110
          },
          manifestHash: expect.stringMatching(/^[a-f0-9]{64}$/)
        })
      ])
    );
  });

  it("filters route metadata records by confirmed manifest fields", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);

    const response = await app.request(
      "/api/routes/manifest?keyword=users&routeCode=system.users&path=/system/users&requiredPermission=user:view&menuVisible=true&status=enabled",
      { headers: authHeaders }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([
      expect.objectContaining({
        routeCode: "system.users",
        path: "/system/users",
        requiredPermission: "user:view",
        menuVisible: true,
        status: "enabled"
      })
    ]);
  });

  it("returns paged route metadata records when pagination query parameters are provided", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);

    const response = await app.request("/api/routes/manifest?menuVisible=true&page=2&pageSize=2", {
      headers: authHeaders
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      page: 2,
      pageSize: 2,
      total: 6,
      totalPages: 3
    });
    expect(body.data.items).toEqual([
      expect.objectContaining({ routeCode: "system.users" }),
      expect.objectContaining({ routeCode: "system.roles" })
    ]);
  });

  it("rejects invalid route metadata filters", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);

    const statusResponse = await app.request("/api/routes/manifest?status=archived", {
      headers: authHeaders
    });
    const statusBody = await statusResponse.json();
    const menuVisibleResponse = await app.request("/api/routes/manifest?menuVisible=maybe", {
      headers: authHeaders
    });
    const menuVisibleBody = await menuVisibleResponse.json();
    const pageResponse = await app.request("/api/routes/manifest?page=0", {
      headers: authHeaders
    });
    const pageBody = await pageResponse.json();

    expect(statusResponse.status).toBe(400);
    expect(statusBody.error.code).toBe("VALIDATION_INVALID_REQUEST");
    expect(menuVisibleResponse.status).toBe(400);
    expect(menuVisibleBody.error.code).toBe("VALIDATION_INVALID_REQUEST");
    expect(pageResponse.status).toBe(400);
    expect(pageBody.error.code).toBe("VALIDATION_INVALID_REQUEST");
  });

  it("disables stale base route metadata on sync", async () => {
    const services = createInMemoryBackendCoreServices();
    const { app } = await setupInitializedApp(createApp({ backendCoreServices: services }));
    const { authHeaders } = await loginAsAdmin(app);
    const now = "2026-01-01T00:00:00.000Z";
    const staleRoute = {
      id: services["context"].store.nextId("routeMetadata"),
      tenantId: null,
      routeCode: "system.obsolete",
      path: "/system/obsolete",
      titleI18nKey: "routes.system.obsolete",
      requiredPermission: "menu:view",
      metadataJson: {},
      manifestHash: "obsolete",
      menuVisible: true,
      icon: null,
      sortOrder: 999,
      status: "enabled" as const,
      createdAt: now,
      updatedAt: now
    };
    services["context"].store.routeMetadata.set(staleRoute.id, staleRoute);

    const syncResponse = await app.request("/api/routes/sync", {
      method: "POST",
      headers: authHeaders
    });
    const synced = await syncResponse.json();

    expect(syncResponse.status).toBe(200);
    expect(staleRoute.status).toBe("disabled");
    expect(staleRoute.updatedAt).not.toBe(now);
    expect(synced.data).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ routeCode: "system.obsolete" })])
    );
  });

  it("removes menus linked to stale route metadata from current permission context", async () => {
    const services = createInMemoryBackendCoreServices();
    const { app } = await setupInitializedApp(createApp({ backendCoreServices: services }));
    const { authHeaders } = await loginAsAdmin(app);
    const now = "2026-01-01T00:00:00.000Z";
    const staleRoute = {
      id: services["context"].store.nextId("routeMetadata"),
      tenantId: null,
      routeCode: "system.obsolete",
      path: "/system/obsolete",
      titleI18nKey: "routes.system.obsolete",
      requiredPermission: "menu:view",
      metadataJson: {},
      manifestHash: "obsolete",
      menuVisible: true,
      icon: null,
      sortOrder: 999,
      status: "enabled" as const,
      createdAt: now,
      updatedAt: now
    };
    services["context"].store.routeMetadata.set(staleRoute.id, staleRoute);
    const menuResponse = await app.request("/api/menus", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        parentMenuId: "2",
        code: "system.obsolete-route-menu",
        titleI18nKey: "routes.system.obsoleteRouteMenu",
        path: "/system/obsolete-route-menu",
        requiredPermission: "menu:view",
        routeCode: "system.obsolete"
      })
    });
    const beforeSyncResponse = await app.request("/api/auth/me", { headers: authHeaders });

    await app.request("/api/routes/sync", {
      method: "POST",
      headers: authHeaders
    });
    const afterSyncResponse = await app.request("/api/auth/me", { headers: authHeaders });
    const menu = await menuResponse.json();
    const beforeSync = await beforeSyncResponse.json();
    const afterSync = await afterSyncResponse.json();

    expect(menuResponse.status).toBe(201);
    expect(menu.data.routeCode).toBe("system.obsolete");
    expect(beforeSync.data.menus).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "system.obsolete-route-menu" })])
    );
    expect(staleRoute.status).toBe("disabled");
    expect(afterSync.data.menus).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "system.obsolete-route-menu" })])
    );
  });

  it("rejects role updates that would duplicate role code", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);

    const response = await app.request("/api/roles/2", {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ code: "super_admin" })
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("VALIDATION_DUPLICATE_ROLE_CODE");
  });

  it("does not allow generic role updates to change role status", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);

    const response = await app.request("/api/roles/2", {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ status: "disabled" })
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({ id: "2", status: "enabled" });
  });

  it("copies a role with its permission configuration", async () => {
    const services = createInMemoryBackendCoreServices();
    const { app } = await setupInitializedApp(createApp({ backendCoreServices: services }));
    const { authHeaders } = await loginAsAdmin(app);

    await app.request("/api/roles/2/permissions", {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ permissionCodes: ["user:view", "role:view"] })
    });
    services["context"].store.rolePermissions.push({
      roleId: "2",
      permissionCode: "user:view",
      effect: "allow",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    });
    const copyResponse = await app.request("/api/roles/2/copy", {
      method: "POST",
      headers: authHeaders
    });
    const copy = await copyResponse.json();
    const secondCopyResponse = await app.request("/api/roles/2/copy", {
      method: "POST",
      headers: authHeaders
    });
    const secondCopy = await secondCopyResponse.json();
    const permissionsResponse = await app.request(`/api/roles/${copy.data.id}/permissions`, {
      headers: authHeaders
    });
    const permissions = await permissionsResponse.json();

    expect(copyResponse.status).toBe(201);
    expect(secondCopyResponse.status).toBe(201);
    expect(copy.data.id).not.toBe("2");
    expect(secondCopy.data.id).not.toBe(copy.data.id);
    expect(copy.data).toMatchObject({ id: expect.any(String), status: "enabled" });
    expect(copy.data.code).toBe("organization_admin_copy");
    expect(copy.data).toMatchObject({
      description: "Built-in role",
      isBuiltin: false,
      createdBy: "1",
      updatedBy: "1"
    });
    expect(secondCopy.data.code).toBe("organization_admin_copy_2");
    expect(permissions.data).toEqual(["user:view", "role:view"]);
  });

  it("invalidates permission cache and removes grants when an assigned role is disabled", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);

    await app.request("/api/roles/2/permissions", {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ permissionCodes: ["user:view"] })
    });
    await app.request("/api/users", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        username: "role-user",
        displayName: "Role User",
        email: "role-user@example.com",
        phone: "10000000008",
        password: "password1",
        primaryOrganizationId: "1",
        roleId: "2"
      })
    });
    const firstLoginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "role-user", password: "password1" })
    });
    const firstLogin = await firstLoginResponse.json();
    await app.request("/api/auth/change-password", {
      method: "POST",
      headers: { authorization: `Bearer ${firstLogin.data.accessToken}` },
      body: JSON.stringify({ oldPassword: "password1", newPassword: "password2" })
    });
    const loginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "role-user", password: "password2" })
    });
    const login = await loginResponse.json();
    const userHeaders = { authorization: `Bearer ${login.data.accessToken}` };
    const beforeDisableResponse = await app.request("/api/users", { headers: userHeaders });

    await app.request("/api/roles/2/disable", {
      method: "POST",
      headers: authHeaders,
    });
    const afterDisableResponse = await app.request("/api/users", { headers: userHeaders });
    const afterDisable = await afterDisableResponse.json();

    expect(beforeDisableResponse.status).toBe(200);
    expect(afterDisableResponse.status).toBe(403);
    expect(afterDisable.error.code).toBe("PERMISSION_DENIED");
  });

  it("invalidates permission cache and removes grants when an assigned role is soft deleted", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);

    const roleResponse = await app.request("/api/roles", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        name: "Deleted Assigned Role",
        code: "deleted_assigned_role"
      })
    });
    const role = await roleResponse.json();
    await app.request(`/api/roles/${role.data.id}/permissions`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ permissionCodes: ["user:view"] })
    });
    await app.request("/api/users", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        username: "deleted-role-user",
        displayName: "Deleted Role User",
        email: "deleted-role-user@example.com",
        phone: "10000000020",
        password: "password1",
        primaryOrganizationId: "1",
        roleId: role.data.id
      })
    });
    const firstLoginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "deleted-role-user", password: "password1" })
    });
    const firstLogin = await firstLoginResponse.json();
    await app.request("/api/auth/change-password", {
      method: "POST",
      headers: { authorization: `Bearer ${firstLogin.data.accessToken}` },
      body: JSON.stringify({ oldPassword: "password1", newPassword: "password2" })
    });
    const loginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "deleted-role-user", password: "password2" })
    });
    const login = await loginResponse.json();
    const userHeaders = { authorization: `Bearer ${login.data.accessToken}` };
    const beforeDeleteResponse = await app.request("/api/users", { headers: userHeaders });

    await app.request(`/api/roles/${role.data.id}`, {
      method: "DELETE",
      headers: authHeaders
    });
    const afterDeleteResponse = await app.request("/api/users", { headers: userHeaders });
    const afterDelete = await afterDeleteResponse.json();

    expect(beforeDeleteResponse.status).toBe(200);
    expect(afterDeleteResponse.status).toBe(403);
    expect(afterDelete.error.code).toBe("PERMISSION_DENIED");
  });

  it("soft deletes role bindings and prevents login when the assigned role is deleted", async () => {
    const services = createInMemoryBackendCoreServices();
    const { app } = await setupInitializedApp(createApp({ backendCoreServices: services }));
    const { authHeaders } = await loginAsAdmin(app);
    const roleResponse = await app.request("/api/roles", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        name: "Deleted Login Role",
        code: "deleted_login_role"
      })
    });
    const role = await roleResponse.json();
    await app.request(`/api/roles/${role.data.id}/permissions`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ permissionCodes: ["user:view"] })
    });
    const userResponse = await app.request("/api/users", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        username: "deleted-login-role-user",
        displayName: "Deleted Login Role User",
        email: "deleted-login-role-user@example.com",
        phone: "10000000044",
        password: "password1",
        primaryOrganizationId: "1",
        roleId: role.data.id
      })
    });
    const user = await userResponse.json();

    const deleteRoleResponse = await app.request(`/api/roles/${role.data.id}`, {
      method: "DELETE",
      headers: authHeaders
    });
    const loginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "deleted-login-role-user", password: "password1" })
    });
    const login = await loginResponse.json();
    const bindings = [...services["context"].store.userOrganizationRoles.values()].filter(
      (binding) => binding.userId === user.data.id
    );
    const rolePermissions = services["context"].store.rolePermissions.filter(
      (permission) => permission.roleId === role.data.id
    );

    expect(deleteRoleResponse.status).toBe(200);
    expect(bindings).toEqual([
      expect.objectContaining({
        organizationId: "1",
        roleId: role.data.id,
        isDeleted: true,
        status: "disabled",
        isPrimary: false,
        deletedBy: "1"
      })
    ]);
    expect(rolePermissions).toEqual([]);
    expect(loginResponse.status).toBe(403);
    expect(login.error.code).toBe("BUSINESS_NO_ENABLED_ORGANIZATION");
  });

  it("does not grant disabled permission metadata through role permissions", async () => {
    const services = createInMemoryBackendCoreServices();
    const { app } = await setupInitializedApp(createApp({ backendCoreServices: services }));
    const { authHeaders } = await loginAsAdmin(app);

    await app.request("/api/roles/2/permissions", {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ permissionCodes: ["user:view"] })
    });
    await app.request("/api/users", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        username: "disabled-permission-user",
        displayName: "Disabled Permission User",
        email: "disabled-permission-user@example.com",
        phone: "10000000018",
        password: "password1",
        primaryOrganizationId: "1",
        roleId: "2"
      })
    });
    const userViewPermission = services
      .listPermissions()
      .find((permission) => permission.code === "user:view");
    if (!userViewPermission) throw new Error("Expected user:view permission to exist");
    userViewPermission.status = "disabled";

    const firstLoginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "disabled-permission-user", password: "password1" })
    });
    const firstLogin = await firstLoginResponse.json();
    await app.request("/api/auth/change-password", {
      method: "POST",
      headers: { authorization: `Bearer ${firstLogin.data.accessToken}` },
      body: JSON.stringify({ oldPassword: "password1", newPassword: "password2" })
    });
    const loginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "disabled-permission-user", password: "password2" })
    });
    const login = await loginResponse.json();
    const usersResponse = await app.request("/api/users", {
      headers: { authorization: `Bearer ${login.data.accessToken}` }
    });
    const users = await usersResponse.json();

    expect(login.data.permissionCodes).not.toEqual(expect.arrayContaining(["user:view"]));
    expect(usersResponse.status).toBe(403);
    expect(users.error.code).toBe("PERMISSION_API_DENIED");
  });

  it("enables and disables roles through role status endpoints", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);

    await app.request("/api/roles/2/permissions", {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ permissionCodes: ["user:view"] })
    });
    await app.request("/api/users", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        username: "status-user",
        displayName: "Status User",
        email: "status-user@example.com",
        phone: "10000000009",
        password: "password1",
        primaryOrganizationId: "1",
        roleId: "2"
      })
    });
    const firstLoginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "status-user", password: "password1" })
    });
    const firstLogin = await firstLoginResponse.json();
    await app.request("/api/auth/change-password", {
      method: "POST",
      headers: { authorization: `Bearer ${firstLogin.data.accessToken}` },
      body: JSON.stringify({ oldPassword: "password1", newPassword: "password2" })
    });
    const loginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "status-user", password: "password2" })
    });
    const login = await loginResponse.json();
    const userHeaders = { authorization: `Bearer ${login.data.accessToken}` };

    const disableResponse = await app.request("/api/roles/2/disable", {
      method: "POST",
      headers: authHeaders
    });
    const disabledUserResponse = await app.request("/api/users", { headers: userHeaders });
    const enableResponse = await app.request("/api/roles/2/enable", {
      method: "POST",
      headers: authHeaders
    });
    const enabledUserResponse = await app.request("/api/users", { headers: userHeaders });

    expect(disableResponse.status).toBe(200);
    await expect(disableResponse.json()).resolves.toMatchObject({
      data: { id: "2", status: "disabled" }
    });
    expect(disabledUserResponse.status).toBe(403);
    expect(enableResponse.status).toBe(200);
    await expect(enableResponse.json()).resolves.toMatchObject({
      data: { id: "2", status: "enabled" }
    });
    expect(enabledUserResponse.status).toBe(200);
  });

  it("assigns one role per user organization and supports removing the binding", async () => {
    const services = createInMemoryBackendCoreServices();
    const { app, setup } = await setupInitializedApp(createApp({ backendCoreServices: services }));
    const { authHeaders } = await loginAsAdmin(app);
    const childResponse = await app.request("/api/organizations", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ parentOrganizationId: "1", name: "Child", code: "child" })
    });
    const child = await childResponse.json();

    const assignResponse = await app.request(`/api/users/${setup.data.admin.id}/organizations`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ organizationId: child.data.id, roleId: "2" })
    });
    const assign = await assignResponse.json();
    const assignedChildBinding = services["context"].store.userOrganizationRoles.get(assign.data.id);
    if (!assignedChildBinding) throw new Error("Expected assigned child organization binding to exist");
    const duplicateAssignedBindingId = services["context"].store.nextId("userOrganizationRole");
    services["context"].store.userOrganizationRoles.set(duplicateAssignedBindingId, {
      ...assignedChildBinding,
      id: duplicateAssignedBindingId,
      roleId: "3",
      createdAt: assignedChildBinding.updatedAt,
      updatedAt: assignedChildBinding.updatedAt
    });
    const listResponse = await app.request(`/api/users/${setup.data.admin.id}/organizations`, {
      headers: authHeaders
    });
    const list = await listResponse.json();
    const primaryBinding = list.data.find(
      (binding: { organizationId: string }) => binding.organizationId === "1"
    );
    const removeResponse = await app.request(
      `/api/users/${setup.data.admin.id}/organizations/${child.data.id}`,
      { method: "DELETE", headers: authHeaders }
    );
    const remove = await removeResponse.json();
    const listAfterRemoveResponse = await app.request(`/api/users/${setup.data.admin.id}/organizations`, {
      headers: authHeaders
    });
    const listAfterRemove = await listAfterRemoveResponse.json();
    const activeChildBindingIdsAfterRemove = [
      ...services["context"].store.userOrganizationRoles.values()
    ]
      .filter(
        (binding) =>
          binding.userId === setup.data.admin.id &&
          binding.organizationId === child.data.id &&
          !binding.isDeleted
      )
      .map((binding) => binding.id);
    const reassignResponse = await app.request(`/api/users/${setup.data.admin.id}/organizations`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ organizationId: child.data.id, roleId: "2" })
    });
    const reassign = await reassignResponse.json();
    const childBinding = services["context"].store.userOrganizationRoles.get(reassign.data.id);
    if (!childBinding) throw new Error("Expected child organization binding to exist");
    const duplicateBindingId = services["context"].store.nextId("userOrganizationRole");
    services["context"].store.userOrganizationRoles.set(duplicateBindingId, {
      ...childBinding,
      id: duplicateBindingId,
      roleId: "3",
      createdAt: childBinding.updatedAt,
      updatedAt: childBinding.updatedAt
    });
    const repairDuplicateResponse = await app.request(
      `/api/users/${setup.data.admin.id}/organizations`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ organizationId: child.data.id, roleId: "2" })
      }
    );
    const listAfterDuplicateRepairResponse = await app.request(
      `/api/users/${setup.data.admin.id}/organizations`,
      { headers: authHeaders }
    );
    const listAfterDuplicateRepair = await listAfterDuplicateRepairResponse.json();
    const childBindingsAfterRepair = listAfterDuplicateRepair.data.filter(
      (binding: { organizationId: string }) => binding.organizationId === child.data.id
    );
    const primaryUpdateResponse = await app.request(`/api/users/${setup.data.admin.id}`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ primaryOrganizationId: child.data.id })
    });
    const listAfterPrimaryUpdateResponse = await app.request(
      `/api/users/${setup.data.admin.id}/organizations`,
      { headers: authHeaders }
    );
    const listAfterPrimaryUpdate = await listAfterPrimaryUpdateResponse.json();

    expect(assign.data).toMatchObject({
      userId: setup.data.admin.id,
      organizationId: child.data.id,
      roleId: "2",
      isPrimary: false,
      status: "enabled",
      createdBy: "1",
      updatedBy: "1"
    });
    expect(listResponse.status).toBe(200);
    expect(primaryBinding).toMatchObject({
      organizationId: "1",
      isPrimary: true,
      status: "enabled"
    });
    expect(list.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: setup.data.admin.id,
          organizationId: child.data.id,
          roleId: "2",
          isPrimary: false,
          status: "enabled"
        })
      ])
    );
    expect(remove.data.removed).toBe(true);
    expect(activeChildBindingIdsAfterRemove).toEqual([]);
    expect(listAfterRemove.data).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ organizationId: child.data.id })])
    );
    expect(reassign.data).toMatchObject({
      id: assign.data.id,
      userId: setup.data.admin.id,
      organizationId: child.data.id,
      roleId: "2",
      isPrimary: false,
      status: "enabled",
      isDeleted: false,
      deletedAt: null,
      deletedBy: null
    });
    expect(repairDuplicateResponse.status).toBe(200);
    expect(childBindingsAfterRepair).toEqual([
      expect.objectContaining({
        id: reassign.data.id,
        organizationId: child.data.id,
        roleId: "2",
        isDeleted: false,
        status: "enabled"
      })
    ]);
    expect(primaryUpdateResponse.status).toBe(200);
    expect(listAfterPrimaryUpdate.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ organizationId: "1", isPrimary: false, updatedBy: "1" }),
        expect.objectContaining({ organizationId: child.data.id, isPrimary: true, updatedBy: "1" })
      ])
    );
  });

  it("preserves the primary organization marker when reassigning its role", async () => {
    const services = createInMemoryBackendCoreServices();
    const { app } = await setupInitializedApp(createApp({ backendCoreServices: services }));
    const { authHeaders } = await loginAsAdmin(app);
    const createResponse = await app.request("/api/users", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        username: "primary-binding-user",
        password: "Password1",
        displayName: "Primary Binding User",
        email: "primary-binding-user@example.com",
        phone: "555-3700",
        primaryOrganizationId: "1",
        roleId: "2"
      })
    });
    const created = await createResponse.json();
    const originalBindingResponse = await app.request(
      `/api/users/${created.data.id}/organizations`,
      { headers: authHeaders }
    );
    const originalBindings = await originalBindingResponse.json();
    const originalPrimary = originalBindings.data.find(
      (binding: { organizationId: string }) => binding.organizationId === "1"
    );
    const originalPrimaryRecord = services["context"].store.userOrganizationRoles.get(
      originalPrimary.id
    );
    if (!originalPrimaryRecord) throw new Error("Expected original primary binding to exist");
    const duplicateBindingId = services["context"].store.nextId("userOrganizationRole");
    services["context"].store.userOrganizationRoles.set(duplicateBindingId, {
      ...originalPrimaryRecord,
      id: duplicateBindingId,
      roleId: "3"
    });

    const reassignResponse = await app.request(`/api/users/${created.data.id}/organizations`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ organizationId: "1", roleId: "3" })
    });
    const reassigned = await reassignResponse.json();
    const listResponse = await app.request(`/api/users/${created.data.id}/organizations`, {
      headers: authHeaders
    });
    const list = await listResponse.json();
    const activePrimaryBindings = [...services["context"].store.userOrganizationRoles.values()].filter(
      (binding) =>
        binding.userId === created.data.id &&
        binding.organizationId === "1" &&
        binding.isPrimary &&
        !binding.isDeleted
    );

    expect(createResponse.status).toBe(201);
    expect(reassignResponse.status).toBe(200);
    expect(reassigned.data).toMatchObject({
      id: originalPrimary.id,
      userId: created.data.id,
      organizationId: "1",
      roleId: "3",
      isPrimary: true,
      status: "enabled",
      updatedBy: "1"
    });
    expect(list.data).toEqual([
      expect.objectContaining({
        id: originalPrimary.id,
        organizationId: "1",
        roleId: "3",
        isPrimary: true,
        isDeleted: false
      })
    ]);
    expect(activePrimaryBindings.map((binding) => binding.id)).toEqual([originalPrimary.id]);
  });

  it("rejects removing a user's primary organization binding", async () => {
    const { app, setup } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);

    const response = await app.request(
      `/api/users/${setup.data.admin.id}/organizations/1`,
      { method: "DELETE", headers: authHeaders }
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_INVALID_REQUEST");
  });

  it("switches current organization and refreshes permission context", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    const childResponse = await app.request("/api/organizations", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ parentOrganizationId: "1", name: "Child", code: "child" })
    });
    const child = await childResponse.json();

    await app.request("/api/roles/2/permissions", {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ permissionCodes: ["organization:view"] })
    });
    const userResponse = await app.request("/api/users", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        username: "switch-user",
        displayName: "Switch User",
        email: "switch-user@example.com",
        phone: "10000000011",
        password: "password1",
        primaryOrganizationId: "1",
        roleId: "3"
      })
    });
    const user = await userResponse.json();
    await app.request(`/api/users/${user.data.id}/organizations`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ organizationId: child.data.id, roleId: "2" })
    });
    const firstLoginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "switch-user", password: "password1" })
    });
    const firstLogin = await firstLoginResponse.json();
    await app.request("/api/auth/change-password", {
      method: "POST",
      headers: { authorization: `Bearer ${firstLogin.data.accessToken}` },
      body: JSON.stringify({ oldPassword: "password1", newPassword: "password2" })
    });
    const loginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "switch-user", password: "password2" })
    });
    const login = await loginResponse.json();
    const userHeaders = { authorization: `Bearer ${login.data.accessToken}` };

    const switchResponse = await app.request("/api/context/current-organization", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({ organizationId: child.data.id })
    });
    const switched = await switchResponse.json();
    const refreshedHeaders = {
      authorization: `Bearer ${switched.data.accessToken}`
    };
    const oldTokenResponse = await app.request("/api/users", { headers: userHeaders });
    const oldToken = await oldTokenResponse.json();
    const organizationResponse = await app.request("/api/organizations/tree", {
      headers: refreshedHeaders
    });
    const usersResponse = await app.request("/api/users", { headers: refreshedHeaders });
    const users = await usersResponse.json();

    expect(switchResponse.status).toBe(200);
    expect(switched.data.session.currentOrganizationId).toBe(child.data.id);
    expect(switched.data.currentOrganization.id).toBe(child.data.id);
    expect(switched.data.permissionCodes).toEqual(["organization:view"]);
    expect(switched.data.menus).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "system.organizations" })])
    );
    expect(switched.data.menus).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "system.users" })])
    );
    expect(oldTokenResponse.status).toBe(401);
    expect(oldToken.error.code).toBe("AUTH_TOKEN_INVALIDATED");
    expect(organizationResponse.status).toBe(200);
    expect(usersResponse.status).toBe(403);
    expect(users.error.code).toBe("PERMISSION_API_DENIED");
  });

  it("rejects stale current-organization sessions after a role binding is removed", async () => {
    const { app, setup } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    const childResponse = await app.request("/api/organizations", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        parentOrganizationId: "1",
        name: "Removed Binding Child",
        code: "removed-binding-child"
      })
    });
    const child = await childResponse.json();
    const userResponse = await app.request("/api/users", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        username: "removed-binding-user",
        displayName: "Removed Binding User",
        email: "removed-binding-user@example.com",
        phone: "10000000045",
        password: "password1",
        primaryOrganizationId: "1",
        roleId: "3"
      })
    });
    const user = await userResponse.json();
    await app.request(`/api/users/${user.data.id}/organizations`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ organizationId: child.data.id, roleId: "2" })
    });
    const firstLoginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "removed-binding-user", password: "password1" })
    });
    const firstLogin = await firstLoginResponse.json();
    await app.request("/api/auth/change-password", {
      method: "POST",
      headers: { authorization: `Bearer ${firstLogin.data.accessToken}` },
      body: JSON.stringify({ oldPassword: "password1", newPassword: "password2" })
    });
    const loginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "removed-binding-user", password: "password2" })
    });
    const login = await loginResponse.json();
    const switchResponse = await app.request("/api/context/current-organization", {
      method: "POST",
      headers: { authorization: `Bearer ${login.data.accessToken}` },
      body: JSON.stringify({ organizationId: child.data.id })
    });
    const switched = await switchResponse.json();
    const childHeaders = { authorization: `Bearer ${switched.data.accessToken}` };
    const beforeRemoveResponse = await app.request("/api/online-users", { headers: authHeaders });
    const beforeRemove = await beforeRemoveResponse.json();

    await app.request(`/api/users/${user.data.id}/organizations/${child.data.id}`, {
      method: "DELETE",
      headers: authHeaders
    });
    const staleAccessResponse = await app.request("/api/auth/me", { headers: childHeaders });
    const staleAccess = await staleAccessResponse.json();
    const staleRefreshResponse = await app.request("/api/auth/refresh", {
      method: "POST",
      headers: { cookie: loginResponse.headers.get("set-cookie") ?? "" }
    });
    const staleRefresh = await staleRefreshResponse.json();
    const afterRemoveResponse = await app.request("/api/online-users", { headers: authHeaders });
    const afterRemove = await afterRemoveResponse.json();

    expect(setup.data.admin.id).toBe("1");
    expect(beforeRemove.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: switched.data.session.id })])
    );
    expect(staleAccessResponse.status).toBe(403);
    expect(staleAccess.error.code).toBe("PERMISSION_DENIED");
    expect(staleRefreshResponse.status).toBe(403);
    expect(staleRefresh.error.code).toBe("PERMISSION_DENIED");
    expect(afterRemove.data).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: switched.data.session.id })])
    );
  });

  it("keeps super administrator permissions across organization context", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    const childResponse = await app.request("/api/organizations", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ parentOrganizationId: "1", name: "Child", code: "child" })
    });
    const child = await childResponse.json();

    await app.request("/api/roles/2/permissions", {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ permissionCodes: ["organization:view"] })
    });

    const switchResponse = await app.request("/api/context/current-organization", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ organizationId: child.data.id })
    });
    const switched = await switchResponse.json();
    const refreshedHeaders = {
      authorization: `Bearer ${switched.data.accessToken}`
    };
    const usersResponse = await app.request("/api/users", { headers: refreshedHeaders });

    expect(switchResponse.status).toBe(200);
    expect(switched.data.currentOrganization.id).toBe(child.data.id);
    expect(switched.data.permissionCodes).toEqual(
      expect.arrayContaining(["organization:view", "user:view", "role:view"])
    );
    expect(switched.data.menus).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "system.users" })])
    );
    expect(usersResponse.status).toBe(200);
  });

  it("invalidates super administrator cached permissions in unbound organization contexts", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    const childResponse = await app.request("/api/organizations", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ parentOrganizationId: "1", name: "Unbound Child", code: "unbound-child" })
    });
    const child = await childResponse.json();
    const switchResponse = await app.request("/api/context/current-organization", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ organizationId: child.data.id })
    });
    const switched = await switchResponse.json();
    const childHeaders = {
      authorization: `Bearer ${switched.data.accessToken}`
    };
    const beforeDisableResponse = await app.request("/api/users", { headers: childHeaders });

    const disableResponse = await app.request("/api/roles/1/disable", {
      method: "POST",
      headers: childHeaders
    });
    const afterDisableResponse = await app.request("/api/users", { headers: childHeaders });
    const afterDisable = await afterDisableResponse.json();

    expect(switchResponse.status).toBe(200);
    expect(beforeDisableResponse.status).toBe(200);
    expect(disableResponse.status).toBe(200);
    expect(afterDisableResponse.status).toBe(403);
    expect(afterDisable.error.code).toBe("PERMISSION_DENIED");
  });

  it("invalidates all cached super administrator contexts when permission manifests sync", async () => {
    const services = createInMemoryBackendCoreServices();
    const { app } = await setupInitializedApp(createApp({ backendCoreServices: services }));
    const { authHeaders } = await loginAsAdmin(app);
    const childResponse = await app.request("/api/organizations", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        parentOrganizationId: "1",
        name: "Manifest Sync Child",
        code: "manifest-sync-child"
      })
    });
    const child = await childResponse.json();
    const userViewPermission = services
      .listPermissions()
      .find((permission) => permission.code === "user:view");
    if (!userViewPermission) throw new Error("Expected user:view permission to exist");
    userViewPermission.status = "disabled";

    const switchResponse = await app.request("/api/context/current-organization", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ organizationId: child.data.id })
    });
    const switched = await switchResponse.json();
    const childHeaders = { authorization: `Bearer ${switched.data.accessToken}` };
    const cachedResponse = await app.request("/api/context/permissions", { headers: childHeaders });
    const cached = await cachedResponse.json();
    const syncResponse = await app.request("/api/permissions/sync", {
      method: "POST",
      headers: childHeaders
    });
    const refreshedResponse = await app.request("/api/context/permissions", {
      headers: childHeaders
    });
    const refreshed = await refreshedResponse.json();

    expect(switchResponse.status).toBe(200);
    expect(cached.data.permissionCodes).not.toEqual(expect.arrayContaining(["user:view"]));
    expect(syncResponse.status).toBe(200);
    expect(refreshed.data.permissionCodes).toEqual(expect.arrayContaining(["user:view"]));
  });

  it("supports the PRD auth current-organization alias", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    const childResponse = await app.request("/api/organizations", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ parentOrganizationId: "1", name: "Child", code: "child" })
    });
    const child = await childResponse.json();

    const switchResponse = await app.request("/api/auth/current-organization", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ organizationId: child.data.id })
    });
    const switched = await switchResponse.json();

    expect(switchResponse.status).toBe(200);
    expect(switched.data.currentOrganization.id).toBe(child.data.id);
    expect(switched.data.accessToken).toEqual(expect.any(String));
  });

  it("prevents switching to a disabled organization", async () => {
    const { app, setup } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    const childResponse = await app.request("/api/organizations", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ parentOrganizationId: "1", name: "Child", code: "child" })
    });
    const child = await childResponse.json();
    await app.request(`/api/users/${setup.data.admin.id}/organizations`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ organizationId: child.data.id, roleId: "2" })
    });
    await app.request(`/api/organizations/${child.data.id}/disable`, {
      method: "POST",
      headers: authHeaders
    });

    const switchResponse = await app.request("/api/context/current-organization", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ organizationId: child.data.id })
    });
    const body = await switchResponse.json();

    expect(switchResponse.status).toBe(409);
    expect(body.error.code).toBe("BUSINESS_ORG_DISABLED");
  });

  it("returns stable validation error codes for invalid requests", async () => {
    const app = createApp();
    const response = await app.request("/api/initialization/setup", {
      method: "POST",
      body: JSON.stringify({
        organizationName: "",
        organizationCode: "default",
        adminUsername: "admin",
        adminDisplayName: "Super Admin",
        adminEmail: "not-an-email",
        adminPhone: "10000000000",
        adminPassword: "password1"
      })
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_INVALID_REQUEST");
  });

  it("returns stable validation error codes for malformed JSON requests", async () => {
    const app = createApp();
    const response = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{"
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_INVALID_REQUEST");
  });

  it("validates integer string path IDs before resource lookup", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);

    const organizationResponse = await app.request("/api/organizations/not-an-id", {
      headers: authHeaders
    });
    const organizationBody = await organizationResponse.json();
    const userResponse = await app.request("/api/users/not-an-id", {
      headers: authHeaders
    });
    const userBody = await userResponse.json();
    const roleResponse = await app.request("/api/roles/not-an-id", {
      headers: authHeaders
    });
    const roleBody = await roleResponse.json();
    const menuResponse = await app.request("/api/menus/not-an-id", {
      method: "DELETE",
      headers: authHeaders
    });
    const menuBody = await menuResponse.json();
    const bindingResponse = await app.request("/api/users/1/organizations/not-an-id", {
      method: "DELETE",
      headers: authHeaders
    });
    const bindingBody = await bindingResponse.json();

    expect(organizationResponse.status).toBe(400);
    expect(organizationBody.error.code).toBe("VALIDATION_INVALID_REQUEST");
    expect(userResponse.status).toBe(400);
    expect(userBody.error.code).toBe("VALIDATION_INVALID_REQUEST");
    expect(roleResponse.status).toBe(400);
    expect(roleBody.error.code).toBe("VALIDATION_INVALID_REQUEST");
    expect(menuResponse.status).toBe(400);
    expect(menuBody.error.code).toBe("VALIDATION_INVALID_REQUEST");
    expect(bindingResponse.status).toBe(400);
    expect(bindingBody.error.code).toBe("VALIDATION_INVALID_REQUEST");
  });

  it("validates optional logout session IDs as integer strings", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);

    const response = await app.request("/api/auth/logout", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ sessionId: "not-an-id" })
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_INVALID_REQUEST");
  });

  it("returns stable business error codes", async () => {
    const { app } = await setupInitializedApp();
    const response = await app.request("/api/initialization/setup", {
      method: "POST",
      body: JSON.stringify({
        organizationName: "Default Organization",
        organizationCode: "default-2",
        adminUsername: "admin2",
        adminDisplayName: "Super Admin",
        adminEmail: "admin2@example.com",
        adminPhone: "10000000001",
        adminPassword: "password1"
      })
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("BUSINESS_SYSTEM_ALREADY_INITIALIZED");
  });

  it("returns stable not-found errors without parsing stale bearer tokens", async () => {
    const app = createApp();
    const response = await app.request("/api/not-a-route", {
      headers: { authorization: "Bearer not-a-valid-access-token" }
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("SYSTEM_NOT_FOUND");
  });

  it("requires a bearer access token for private API permissions", async () => {
    const { app } = await setupInitializedApp();
    const response = await app.request("/api/users");
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("AUTH_TOKEN_EXPIRED");
  });

  it("denies authenticated users without the required API permission", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);

    await app.request("/api/users", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        username: "normal",
        displayName: "Normal User",
        email: "normal@example.com",
        phone: "10000000002",
        password: "password1",
        primaryOrganizationId: "1",
        roleId: "3"
      })
    });

    const normalLoginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "normal", password: "password1" })
    });
    const normalLogin = await normalLoginResponse.json();
    await app.request("/api/auth/change-password", {
      method: "POST",
      headers: {
        authorization: `Bearer ${normalLogin.data.accessToken}`
      },
      body: JSON.stringify({ oldPassword: "password1", newPassword: "password2" })
    });
    const updatedNormalLoginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "normal", password: "password2" })
    });
    const updatedNormalLogin = await updatedNormalLoginResponse.json();
    const response = await app.request("/api/users", {
      headers: {
        authorization: `Bearer ${updatedNormalLogin.data.accessToken}`
      }
    });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("PERMISSION_API_DENIED");
  });

  it("denies online-user listing without the online-user view permission", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);

    await app.request("/api/users", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        username: "online-denied",
        displayName: "Online Denied",
        email: "online-denied@example.com",
        phone: "10000000023",
        password: "password1",
        primaryOrganizationId: "1",
        roleId: "3"
      })
    });

    const firstLoginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "online-denied", password: "password1" })
    });
    const firstLogin = await firstLoginResponse.json();
    await app.request("/api/auth/change-password", {
      method: "POST",
      headers: { authorization: `Bearer ${firstLogin.data.accessToken}` },
      body: JSON.stringify({ oldPassword: "password1", newPassword: "password2" })
    });
    const loginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "online-denied", password: "password2" })
    });
    const login = await loginResponse.json();
    const response = await app.request("/api/online-users", {
      headers: { authorization: `Bearer ${login.data.accessToken}` }
    });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("PERMISSION_API_DENIED");
  });

  it("forces first-login password change and invalidates old credentials after change", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);

    await app.request("/api/users", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        username: "new-user",
        displayName: "New User",
        email: "new-user@example.com",
        phone: "10000000003",
        password: "password1",
        primaryOrganizationId: "1",
        roleId: "3"
      })
    });

    const firstLoginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "new-user", password: "password1" })
    });
    const firstLogin = await firstLoginResponse.json();
    const blockedResponse = await app.request("/api/users", {
      headers: { authorization: `Bearer ${firstLogin.data.accessToken}` }
    });
    const blocked = await blockedResponse.json();
    const changePasswordResponse = await app.request("/api/auth/change-password", {
      method: "POST",
      headers: { authorization: `Bearer ${firstLogin.data.accessToken}` },
      body: JSON.stringify({ oldPassword: "password1", newPassword: "password2" })
    });
    const changedUser = await changePasswordResponse.json();
    const oldTokenResponse = await app.request("/api/users", {
      headers: { authorization: `Bearer ${firstLogin.data.accessToken}` }
    });
    const oldToken = await oldTokenResponse.json();
    const oldPasswordLoginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "new-user", password: "password1" })
    });
    const onlineUsersResponse = await app.request("/api/online-users", {
      headers: authHeaders
    });
    const onlineUsers = await onlineUsersResponse.json();

    expect(blockedResponse.status).toBe(403);
    expect(blocked.error.code).toBe("AUTH_PASSWORD_CHANGE_REQUIRED");
    expect(changePasswordResponse.status).toBe(200);
    expect(changedUser.data.firstLoginPasswordChangeRequired).toBe(false);
    expect(changedUser.data.tokenVersion).toBe(1);
    expect(changedUser.data.updatedBy).toBe(firstLogin.data.user.id);
    expect(oldTokenResponse.status).toBe(401);
    expect(oldToken.error.code).toBe("AUTH_TOKEN_INVALIDATED");
    expect(oldPasswordLoginResponse.status).toBe(401);
    expect(onlineUsers.data).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ userId: firstLogin.data.user.id })])
    );
  });

  it("allows current user context while first-login password change is required", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);

    await app.request("/api/users", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        username: "context-user",
        displayName: "Context User",
        email: "context-user@example.com",
        phone: "10000000004",
        password: "password1",
        primaryOrganizationId: "1",
        roleId: "3"
      })
    });
    const loginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "context-user", password: "password1" })
    });
    const login = await loginResponse.json();
    const response = await app.request("/api/auth/me", {
      headers: { authorization: `Bearer ${login.data.accessToken}` }
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.user.username).toBe("context-user");
    expect(body.data.passwordChangeRequired).toBe(true);
  });

  it("requires password change when the configurable periodic password cycle has expired", async () => {
    const services = createInMemoryBackendCoreServices({
      passwordPolicy: {
        ...defaultPasswordPolicy,
        periodicChangeDays: 0
      }
    });
    const { app } = await setupInitializedApp(createApp({ backendCoreServices: services }));
    const { authHeaders } = await loginAsAdmin(app);
    const response = await app.request("/api/users", { headers: authHeaders });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("AUTH_PASSWORD_CHANGE_REQUIRED");
  });
});

function setupResponseStatus(setup: { data: { state: { status: string } } }) {
  return setup.data.state.status;
}
