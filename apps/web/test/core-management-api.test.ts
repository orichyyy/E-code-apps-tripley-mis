import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createUser,
  fetchMenus,
  fetchOrganizations,
  fetchRolePermissions,
  fetchUsers,
  resetUserPassword,
  setUserStatus,
  updateMenuApiBindings,
  updateRolePermissions,
} from "../src/features/core-management/core-management-api";

describe("core management API", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("loads paginated users and flattens tree-backed resources", async () => {
    localStorage.setItem("web-admin.access-token", "token");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.startsWith("/api/users")) {
        return Promise.resolve(
          jsonResponse({
            data: {
              items: [{ id: "1", username: "admin", displayName: "Super Administrator" }],
            },
          }),
        );
      }
      return Promise.resolve(
        jsonResponse({
          data: [
            {
              id: "1",
              name: "Root",
              code: "root",
              children: [{ id: "2", name: "Child", code: "child" }],
            },
          ],
        }),
      );
    });

    const users = await fetchUsers("adm");
    const organizations = await fetchOrganizations();
    const menus = await fetchMenus();

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/users?page=1&pageSize=100&keyword=adm", {
      headers: { authorization: "Bearer token" },
    });
    expect(users).toEqual([expect.objectContaining({ id: "1", username: "admin" })]);
    expect(organizations.map((item) => item.id)).toEqual(["1", "2"]);
    expect(menus.map((item) => item.id)).toEqual(["1", "2"]);
  });

  it("creates users and executes user lifecycle actions", async () => {
    localStorage.setItem("web-admin.access-token", "token");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() => Promise.resolve(jsonResponse({ data: { id: "1" } })));

    await createUser({
      username: "operator",
      displayName: "Operator",
      email: "operator@example.com",
      phone: "10000000001",
      password: "Password1",
      primaryOrganizationId: "1",
      roleId: "3",
      sortOrder: "",
    });
    await setUserStatus("1", "disable");
    await resetUserPassword("1", "Reset1234");

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/users", {
      method: "POST",
      body: JSON.stringify({
        username: "operator",
        displayName: "Operator",
        email: "operator@example.com",
        phone: "10000000001",
        password: "Password1",
        primaryOrganizationId: "1",
        roleId: "3",
      }),
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json",
      },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/users/1/disable", {
      method: "POST",
      headers: { authorization: "Bearer token" },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/users/1/reset-password", {
      method: "POST",
      body: JSON.stringify({ password: "Reset1234" }),
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json",
      },
    });
  });

  it("reads and saves role permissions and menu API bindings", async () => {
    localStorage.setItem("web-admin.access-token", "token");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url === "/api/roles/1/permissions") {
        return Promise.resolve(jsonResponse({ data: ["user:view"] }));
      }
      return Promise.resolve(jsonResponse({ data: { ok: true } }));
    });

    const rolePermissions = await fetchRolePermissions("1");
    await updateRolePermissions("1", ["user:view", "role:view"]);
    await updateMenuApiBindings("2", ["7", "8"]);

    expect(rolePermissions).toEqual(["user:view"]);
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/roles/1/permissions", {
      method: "PUT",
      body: JSON.stringify({ permissionCodes: ["user:view", "role:view"] }),
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json",
      },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/menus/2/api-bindings", {
      method: "PUT",
      body: JSON.stringify({ apiPermissionIds: ["7", "8"] }),
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json",
      },
    });
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
