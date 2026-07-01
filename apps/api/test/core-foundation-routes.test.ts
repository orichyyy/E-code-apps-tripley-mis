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
    expect(onlineUsers.data).toHaveLength(1);
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
    const refreshResponse = await app.request("/api/auth/refresh", {
      method: "POST",
      headers: { cookie: cookie.split(";")[0] }
    });
    const refresh = await refreshResponse.json();

    expect(logoutResponse.status).toBe(200);
    expect(refreshResponse.status).toBe(401);
    expect(refresh.error.code).toBe("AUTH_TOKEN_EXPIRED");
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

    await app.request("/api/roles/2", {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ status: "disabled" })
    });
    const afterDisableResponse = await app.request("/api/users", { headers: userHeaders });
    const afterDisable = await afterDisableResponse.json();

    expect(beforeDisableResponse.status).toBe(200);
    expect(afterDisableResponse.status).toBe(403);
    expect(afterDisable.error.code).toBe("PERMISSION_API_DENIED");
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
    const removeResponse = await app.request(
      `/api/users/${setup.data.admin.id}/organizations/${child.data.id}`,
      { method: "DELETE", headers: authHeaders }
    );
    const remove = await removeResponse.json();

    expect(assign.data).toMatchObject({
      userId: setup.data.admin.id,
      organizationId: child.data.id,
      roleId: "2"
    });
    expect(remove.data.removed).toBe(true);
  });

  it("switches current organization and refreshes permission context", async () => {
    const { app, setup } = await setupInitializedApp();
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
    await app.request(`/api/users/${setup.data.admin.id}/organizations`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ organizationId: child.data.id, roleId: "2" })
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
    const oldTokenResponse = await app.request("/api/users", { headers: authHeaders });
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
