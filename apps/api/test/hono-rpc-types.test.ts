import { expect, it } from "vitest";
import { hc } from "hono/client";

import type { ApiApp } from "../src/app";

it("keeps Hono RPC type inference available for permission extension routes", () => {
  const client = hc<ApiApp>("/");

  const getRoleDataPermissions = client.api.roles[":id"]["data-permissions"].$get;
  const updateRoleDataPermissions = client.api.roles[":id"]["data-permissions"].$put;
  const getRoleFieldPermissions = client.api.roles[":id"]["field-permissions"].$get;
  const updateRoleFieldPermissions = client.api.roles[":id"]["field-permissions"].$put;
  const getUserOverrides = client.api.permissions["user-overrides"][":userId"].$get;
  const updateUserOverrides = client.api.permissions["user-overrides"][":userId"].$put;

  expect(getRoleDataPermissions).toBeDefined();
  expect(updateRoleDataPermissions).toBeDefined();
  expect(getRoleFieldPermissions).toBeDefined();
  expect(updateRoleFieldPermissions).toBeDefined();
  expect(getUserOverrides).toBeDefined();
  expect(updateUserOverrides).toBeDefined();
  expect(client).toBeDefined();
});
