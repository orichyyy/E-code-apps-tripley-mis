import type { AdminRouteMetadata } from "../routes/admin-route-metadata";

export const baseRouteManifest: AdminRouteMetadata[] = [
  {
    routeCode: "dashboard",
    path: "/",
    titleI18nKey: "routes.dashboard",
    menuVisible: true,
    sortOrder: 10
  },
  {
    routeCode: "system.organizations",
    path: "/system/organizations",
    titleI18nKey: "routes.system.organizations",
    requiredPermission: "organization:view",
    menuVisible: true,
    sortOrder: 100
  },
  {
    routeCode: "system.users",
    path: "/system/users",
    titleI18nKey: "routes.system.users",
    requiredPermission: "user:view",
    menuVisible: true,
    sortOrder: 110
  },
  {
    routeCode: "system.roles",
    path: "/system/roles",
    titleI18nKey: "routes.system.roles",
    requiredPermission: "role:view",
    menuVisible: true,
    sortOrder: 120
  },
  {
    routeCode: "system.permissions",
    path: "/system/permissions",
    titleI18nKey: "routes.system.permissions",
    requiredPermission: "permission:view",
    menuVisible: true,
    sortOrder: 130
  },
  {
    routeCode: "system.menus",
    path: "/system/menus",
    titleI18nKey: "routes.system.menus",
    requiredPermission: "menu:view",
    menuVisible: true,
    sortOrder: 140
  }
];
