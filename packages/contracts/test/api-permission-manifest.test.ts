import { describe, expect, it } from "vitest";

import { baseApiPermissionManifest, basePermissionManifest } from "../src";

describe("baseApiPermissionManifest", () => {
  it("uses unique API permission codes and method/path pairs", () => {
    const codes = baseApiPermissionManifest.map((entry) => entry.code);
    const methodPaths = baseApiPermissionManifest.map((entry) => `${entry.method} ${entry.path}`);

    expect(new Set(codes).size).toBe(codes.length);
    expect(new Set(methodPaths).size).toBe(methodPaths.length);
  });

  it("only references declared base permissions", () => {
    const declaredPermissionCodes = new Set(
      basePermissionManifest.map((permission) => permission.code),
    );
    const requiredPermissionCodes = baseApiPermissionManifest
      .map((entry) => entry.requiredPermission)
      .filter((permissionCode): permissionCode is string => Boolean(permissionCode));

    expect(
      requiredPermissionCodes.every((permissionCode) =>
        declaredPermissionCodes.has(permissionCode),
      ),
    ).toBe(true);
  });

  it("requires private management routes to declare RBAC permission codes", () => {
    const authenticatedContextRouteCodes = new Set([
      "api.auth.me",
      "api.auth.logout",
      "api.auth.change-password",
      "api.context.current-organization.switch",
      "api.auth.current-organization.switch",
      "api.context.organizations.list",
      "api.context.permissions",
      "api.announcements.current",
      "api.permissions.effective",
      "api.profile.avatar.update",
      "api.profile.preferences.update",
      "api.profile.update",
      "api.profile.view",
    ]);
    const privateRoutesWithoutRequiredPermission = baseApiPermissionManifest
      .filter((entry) => !entry.public && !entry.requiredPermission)
      .map((entry) => entry.code)
      .sort();

    expect(privateRoutesWithoutRequiredPermission).toEqual(
      [...authenticatedContextRouteCodes].sort(),
    );
  });

  it("declares metadata for backend-core route surfaces", () => {
    expect(baseApiPermissionManifest).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: "POST", path: "/api/auth/login", public: true }),
        expect.objectContaining({
          method: "GET",
          path: "/api/auth/me",
          public: false,
        }),
        expect.objectContaining({
          method: "GET",
          path: "/api/profile",
          public: false,
        }),
        expect.objectContaining({
          method: "PATCH",
          path: "/api/profile/preferences",
          public: false,
        }),
        expect.objectContaining({
          method: "GET",
          path: "/api/organizations/config/depth",
          requiredPermission: "organization:view",
        }),
        expect.objectContaining({
          method: "PATCH",
          path: "/api/organizations/config/depth",
          requiredPermission: "organization:depth:configure",
        }),
        expect.objectContaining({
          method: "POST",
          path: "/api/auth/change-password",
          public: false,
        }),
        expect.objectContaining({
          method: "POST",
          path: "/api/context/current-organization",
          public: false,
        }),
        expect.objectContaining({
          method: "POST",
          path: "/api/auth/current-organization",
          public: false,
        }),
        expect.objectContaining({
          method: "GET",
          path: "/api/context/permissions",
          public: false,
        }),
        expect.objectContaining({
          method: "GET",
          path: "/api/permissions/effective",
          public: false,
        }),
        expect.objectContaining({
          method: "POST",
          path: "/api/users/:id/reset-password",
          requiredPermission: "user:password:reset",
        }),
        expect.objectContaining({
          method: "POST",
          path: "/api/roles/:id/copy",
          requiredPermission: "role:copy",
        }),
        expect.objectContaining({
          method: "POST",
          path: "/api/roles/:id/disable",
          requiredPermission: "role:status:update",
        }),
        expect.objectContaining({
          method: "POST",
          path: "/api/roles/:id/enable",
          requiredPermission: "role:status:update",
        }),
        expect.objectContaining({
          method: "GET",
          path: "/api/users/:id/organizations",
          requiredPermission: "user:view",
        }),
        expect.objectContaining({
          method: "GET",
          path: "/api/roles/:id/permissions",
          requiredPermission: "role:view",
        }),
        expect.objectContaining({
          method: "GET",
          path: "/api/roles/:id/data-permissions",
          requiredPermission: "role:view",
        }),
        expect.objectContaining({
          method: "PUT",
          path: "/api/roles/:id/data-permissions",
          requiredPermission: "role:permissions:update",
        }),
        expect.objectContaining({
          method: "GET",
          path: "/api/roles/:id/field-permissions",
          requiredPermission: "role:view",
        }),
        expect.objectContaining({
          method: "PUT",
          path: "/api/roles/:id/field-permissions",
          requiredPermission: "role:permissions:update",
        }),
        expect.objectContaining({
          method: "GET",
          path: "/api/permissions/user-overrides/:userId",
          requiredPermission: "permission:view",
        }),
        expect.objectContaining({
          method: "PUT",
          path: "/api/permissions/user-overrides/:userId",
          requiredPermission: "permission:sync",
        }),
        expect.objectContaining({
          method: "POST",
          path: "/api/menus",
          requiredPermission: "menu:create",
        }),
        expect.objectContaining({
          method: "PATCH",
          path: "/api/menus/:id",
          requiredPermission: "menu:update",
        }),
        expect.objectContaining({
          method: "DELETE",
          path: "/api/menus/:id",
          requiredPermission: "menu:delete",
        }),
        expect.objectContaining({
          method: "POST",
          path: "/api/routes/sync",
          requiredPermission: "route:sync",
        }),
        expect.objectContaining({
          method: "POST",
          path: "/api/permissions/sync",
          requiredPermission: "permission:sync",
        }),
        expect.objectContaining({
          method: "GET",
          path: "/api/permissions/api",
          requiredPermission: "permission:view",
        }),
        expect.objectContaining({
          method: "POST",
          path: "/api/permissions/api/sync",
          requiredPermission: "permission:api:sync",
        }),
      ]),
    );
  });
});
