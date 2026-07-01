export type BaseMenuManifestEntry = {
  code: string;
  titleI18nKey: string;
  path: string;
  parentCode?: string;
  requiredPermission?: string;
  routeCode?: string;
  sortOrder: number;
};

export const baseMenuManifest: BaseMenuManifestEntry[] = [
  {
    code: "dashboard",
    titleI18nKey: "routes.dashboard",
    path: "/",
    routeCode: "dashboard",
    sortOrder: 10
  },
  {
    code: "system",
    titleI18nKey: "routes.system",
    path: "/system",
    sortOrder: 100
  },
  {
    code: "system.organizations",
    titleI18nKey: "routes.system.organizations",
    path: "/system/organizations",
    parentCode: "system",
    requiredPermission: "organization:view",
    routeCode: "system.organizations",
    sortOrder: 100
  },
  {
    code: "system.users",
    titleI18nKey: "routes.system.users",
    path: "/system/users",
    parentCode: "system",
    requiredPermission: "user:view",
    routeCode: "system.users",
    sortOrder: 110
  },
  {
    code: "system.roles",
    titleI18nKey: "routes.system.roles",
    path: "/system/roles",
    parentCode: "system",
    requiredPermission: "role:view",
    routeCode: "system.roles",
    sortOrder: 120
  },
  {
    code: "system.permissions",
    titleI18nKey: "routes.system.permissions",
    path: "/system/permissions",
    parentCode: "system",
    requiredPermission: "permission:view",
    routeCode: "system.permissions",
    sortOrder: 130
  },
  {
    code: "system.menus",
    titleI18nKey: "routes.system.menus",
    path: "/system/menus",
    parentCode: "system",
    requiredPermission: "menu:view",
    routeCode: "system.menus",
    sortOrder: 140
  }
];
