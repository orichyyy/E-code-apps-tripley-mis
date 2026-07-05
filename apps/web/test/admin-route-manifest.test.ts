import { baseMenuManifest, baseRouteManifest } from "@web-admin-base/contracts";
import { describe, expect, it } from "vitest";

import { adminRoutes } from "../src/route-metadata/admin-routes";

describe("admin route metadata manifest alignment", () => {
  it("declares every menu-visible frontend admin route in the shared base manifests", () => {
    const baseRouteCodes = new Set(baseRouteManifest.map((route) => route.routeCode));
    const baseMenuRouteCodes = new Set(
      baseMenuManifest
        .map((menu) => menu.routeCode)
        .filter((routeCode): routeCode is string => Boolean(routeCode))
    );
    const visibleFrontendRouteCodes = adminRoutes
      .filter((route) => route.menuVisible)
      .map((route) => route.routeCode);

    expect(visibleFrontendRouteCodes.every((routeCode) => baseRouteCodes.has(routeCode))).toBe(true);
    expect(visibleFrontendRouteCodes.every((routeCode) => baseMenuRouteCodes.has(routeCode))).toBe(true);
  });
});
