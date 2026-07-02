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
        expect.objectContaining({ id: expect.any(String), code: "user:view" })
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
    expect(status.data.initialized).toBe(true);
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
    expect(onlineUsers.data).toHaveLength(1);
    expect(onlineUsers.data[0].status).toBe("active");
    expect(onlineUsers.data[0].tokenVersion).toBe(0);
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

  it("returns current user context with organizations, permissions, and menus", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    const response = await app.request("/api/auth/me", { headers: authHeaders });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.user.username).toBe("admin");
    expect(body.data.session.currentOrganizationId).toBe("1");
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

    expect(response.status).toBe(200);
    expect(body.data.currentOrganization.id).toBe("1");
    expect(body.data.permissionCodes).toEqual(expect.arrayContaining(["menu:view", "user:view"]));
    expect(body.data.menus).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "system.users" })])
    );
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
    expect(logout.data.status).toBe("revoked");
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
    const disabledResponse = await app.request("/api/organizations/1/disable", {
      method: "POST",
      headers: authHeaders
    });
    const disabled = await disabledResponse.json();

    expect(child.data.level).toBe(2);
    expect(child.data.path).toEqual(expect.any(String));
    expect(disabled.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "1", status: "disabled" }),
        expect.objectContaining({ id: "2", status: "disabled" })
      ])
    );
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

  it("locks accounts according to the configured failed-login policy", async () => {
    const services = createInMemoryBackendCoreServices({
      failedLoginMaxAttempts: 2,
      failedLoginLockMinutes: 30
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
    const lockedLoginResponse = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "admin", password: "password1" })
    });
    const lockedLogin = await lockedLoginResponse.json();

    expect(lockedLoginResponse.status).toBe(423);
    expect(lockedLogin.error.code).toBe("AUTH_ACCOUNT_LOCKED");
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

    expect(role.data.id).toBe("1");
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

    expect(response.status).toBe(200);
    expect(body.data.permissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: expect.any(String), code: "permission:sync" })
      ])
    );
    expect(body.data.apiPermissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: expect.any(String), path: "/api/permissions/sync" })
      ])
    );
    expect(secondBody.data.permissions[0].id).toBe(body.data.permissions[0].id);
    expect(secondBody.data.apiPermissions[0].id).toBe(body.data.apiPermissions[0].id);
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
          status: "enabled"
        })
      ])
    );
  });

  it("reads role permission codes", async () => {
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);
    await app.request("/api/roles/2/permissions", {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ permissionCodes: ["user:view", "role:view"] })
    });

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
        sortOrder: 150
      })
    });
    const created = await createResponse.json();

    const updateResponse = await app.request(`/api/menus/${created.data.id}`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ titleI18nKey: "routes.system.auditLogs", status: "disabled" })
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
      code: "system.audit"
    });
    expect(updated.data).toMatchObject({
      titleI18nKey: "routes.system.auditLogs",
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

    expect(organization.data).toMatchObject({ createdBy: "1", updatedBy: "1" });
    expect(organizationUpdate.data).toMatchObject({ updatedBy: "1" });
    expect(organizationDisable.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: organization.data.id, updatedBy: "1" })])
    );
    expect(user.data).toMatchObject({ createdBy: "1", updatedBy: "1" });
    expect(userUpdate.data).toMatchObject({ updatedBy: "1" });
    expect(userLock.data).toMatchObject({ updatedBy: "1" });
    expect(reset.data).toMatchObject({ updatedBy: "1" });
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
          requiredPermission: "user:view"
        })
      ])
    );
    expect(syncResponse.status).toBe(200);
    expect(synced.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ routeCode: "system.users" })])
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
    const { app } = await setupInitializedApp();
    const { authHeaders } = await loginAsAdmin(app);

    await app.request("/api/roles/2/permissions", {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ permissionCodes: ["user:view", "role:view"] })
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
    expect(secondCopy.data.code).toBe("organization_admin_copy_2");
    expect(permissions.data).toEqual(expect.arrayContaining(["user:view", "role:view"]));
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
    expect(afterDisable.error.code).toBe("PERMISSION_API_DENIED");
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
    const { app, setup } = await setupInitializedApp();
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
    const reassignResponse = await app.request(`/api/users/${setup.data.admin.id}/organizations`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ organizationId: child.data.id, roleId: "2" })
    });
    const reassign = await reassignResponse.json();

    expect(assign.data).toMatchObject({
      userId: setup.data.admin.id,
      organizationId: child.data.id,
      roleId: "2",
      isPrimary: false,
      status: "enabled"
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

    expect(blockedResponse.status).toBe(403);
    expect(blocked.error.code).toBe("AUTH_PASSWORD_CHANGE_REQUIRED");
    expect(changePasswordResponse.status).toBe(200);
    expect(changedUser.data.firstLoginPasswordChangeRequired).toBe(false);
    expect(changedUser.data.tokenVersion).toBe(1);
    expect(oldTokenResponse.status).toBe(401);
    expect(oldToken.error.code).toBe("AUTH_TOKEN_INVALIDATED");
    expect(oldPasswordLoginResponse.status).toBe(401);
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
