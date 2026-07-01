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
