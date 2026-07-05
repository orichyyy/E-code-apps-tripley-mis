import { describe, expect, it } from "vitest";

import { baseMenuManifest, basePermissionManifest, baseRouteManifest } from "../src";

describe("base route and menu manifests", () => {
  it("uses unique route codes and paths", () => {
    const routeCodes = baseRouteManifest.map((route) => route.routeCode);
    const routePaths = baseRouteManifest.map((route) => route.path);

    expect(new Set(routeCodes).size).toBe(routeCodes.length);
    expect(new Set(routePaths).size).toBe(routePaths.length);
  });

  it("uses unique menu codes and paths", () => {
    const menuCodes = baseMenuManifest.map((menu) => menu.code);
    const menuPaths = baseMenuManifest.map((menu) => menu.path);

    expect(new Set(menuCodes).size).toBe(menuCodes.length);
    expect(new Set(menuPaths).size).toBe(menuPaths.length);
  });

  it("only references declared base permissions", () => {
    const declaredPermissionCodes = new Set(
      basePermissionManifest.map((permission) => permission.code),
    );
    const requiredPermissionCodes = [
      ...baseRouteManifest.map((route) => route.requiredPermission),
      ...baseMenuManifest.map((menu) => menu.requiredPermission),
    ].filter((permissionCode): permissionCode is string => Boolean(permissionCode));

    expect(
      requiredPermissionCodes.every((permissionCode) =>
        declaredPermissionCodes.has(permissionCode),
      ),
    ).toBe(true);
  });

  it("only links menus to declared routes and parents", () => {
    const routeCodes = new Set(baseRouteManifest.map((route) => route.routeCode));
    const menuCodes = new Set(baseMenuManifest.map((menu) => menu.code));

    expect(
      baseMenuManifest.every((menu) => !menu.routeCode || routeCodes.has(menu.routeCode)),
    ).toBe(true);
    expect(
      baseMenuManifest.every((menu) => !menu.parentCode || menuCodes.has(menu.parentCode)),
    ).toBe(true);
  });
});
