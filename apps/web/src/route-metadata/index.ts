import type { AdminRouteMetadata } from "@web-admin-base/contracts";

export const adminRouteMetadata: AdminRouteMetadata[] = [
  {
    routeCode: "dashboard",
    path: "/",
    titleI18nKey: "routes.dashboard",
    menuVisible: true,
    sortOrder: 10
  }
];
