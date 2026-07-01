import { describe, expect, it } from "vitest";

import { createApp } from "../src/app";

async function setupInitializedApp() {
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
      adminPassword: "password1"
    })
  });
  const setup = await setupResponse.json();
  return { app, setup };
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
    const loginResponse = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "user-agent": "vitest" },
      body: JSON.stringify({ username: "admin", password: "password1" })
    });
    const login = await loginResponse.json();
    const onlineUsersResponse = await app.request("/api/online-users");
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
    const childResponse = await app.request("/api/organizations", {
      method: "POST",
      body: JSON.stringify({
        parentOrganizationId: "1",
        name: "Child Organization",
        code: "child"
      })
    });
    const child = await childResponse.json();
    const disabledResponse = await app.request("/api/organizations/1/disable", { method: "POST" });
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
    const resetResponse = await app.request(`/api/users/${setup.data.admin.id}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ password: "password2" })
    });
    const reset = await resetResponse.json();

    expect(reset.data.tokenVersion).toBe(1);
    expect(reset.data.firstLoginPasswordChangeRequired).toBe(true);
  });

  it("updates role permissions from the base permission manifest", async () => {
    const { app } = await setupInitializedApp();
    const response = await app.request("/api/roles/1/permissions", {
      method: "PUT",
      body: JSON.stringify({ permissionCodes: ["user:view", "role:view"] })
    });
    const role = await response.json();

    expect(role.data.id).toBe("1");
  });

  it("assigns one role per user organization and supports removing the binding", async () => {
    const { app, setup } = await setupInitializedApp();
    const childResponse = await app.request("/api/organizations", {
      method: "POST",
      body: JSON.stringify({ parentOrganizationId: "1", name: "Child", code: "child" })
    });
    const child = await childResponse.json();

    const assignResponse = await app.request(`/api/users/${setup.data.admin.id}/organizations`, {
      method: "POST",
      body: JSON.stringify({ organizationId: child.data.id, roleId: "2" })
    });
    const assign = await assignResponse.json();
    const removeResponse = await app.request(
      `/api/users/${setup.data.admin.id}/organizations/${child.data.id}`,
      { method: "DELETE" }
    );
    const remove = await removeResponse.json();

    expect(assign.data).toMatchObject({
      userId: setup.data.admin.id,
      organizationId: child.data.id,
      roleId: "2"
    });
    expect(remove.data.removed).toBe(true);
  });
});

function setupResponseStatus(setup: { data: { state: { status: string } } }) {
  return setup.data.state.status;
}
