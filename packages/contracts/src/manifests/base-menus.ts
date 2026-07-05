export type BaseMenuManifestEntry = {
  code: string;
  titleI18nKey: string;
  path: string;
  parentCode?: string;
  requiredPermission?: string;
  routeCode?: string;
  sortOrder: number;
  visible?: boolean;
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
  },
  {
    code: "system.config",
    titleI18nKey: "routes.system.config",
    path: "/system/config",
    parentCode: "system",
    requiredPermission: "system-config:view",
    routeCode: "system.config",
    sortOrder: 150
  },
  {
    code: "system.dictionaries",
    titleI18nKey: "routes.system.dictionaries",
    path: "/system/dictionaries",
    parentCode: "system",
    requiredPermission: "dictionary:view",
    routeCode: "system.dictionaries",
    sortOrder: 160
  },
  {
    code: "system.i18nMessages",
    titleI18nKey: "routes.system.i18nMessages",
    path: "/system/i18n-messages",
    parentCode: "system",
    requiredPermission: "i18n:view",
    routeCode: "system.i18nMessages",
    sortOrder: 165
  },
  {
    code: "system.files",
    titleI18nKey: "routes.system.files",
    path: "/system/files",
    parentCode: "system",
    requiredPermission: "file:view",
    routeCode: "system.files",
    sortOrder: 170
  },
  {
    code: "notifications",
    titleI18nKey: "nav.notifications",
    path: "/notifications",
    sortOrder: 200
  },
  {
    code: "notifications.announcements",
    titleI18nKey: "routes.notifications.announcements",
    path: "/notifications/announcements",
    parentCode: "notifications",
    requiredPermission: "announcement:view",
    routeCode: "notifications.announcements",
    sortOrder: 200
  },
  {
    code: "notifications.in-app",
    titleI18nKey: "routes.notifications.inApp",
    path: "/notifications/in-app",
    parentCode: "notifications",
    requiredPermission: "notification:view",
    routeCode: "notifications.in-app",
    sortOrder: 210
  },
  {
    code: "notifications.templates",
    titleI18nKey: "routes.notifications.templates",
    path: "/notifications/templates",
    parentCode: "notifications",
    requiredPermission: "notification-template:view",
    routeCode: "notifications.templates",
    sortOrder: 215
  },
  {
    code: "notifications.webhooks",
    titleI18nKey: "routes.notifications.webhooks",
    path: "/notifications/webhooks",
    parentCode: "notifications",
    requiredPermission: "webhook:view",
    routeCode: "notifications.webhooks",
    sortOrder: 220
  },
  {
    code: "operations",
    titleI18nKey: "nav.operations",
    path: "/operations",
    sortOrder: 300
  },
  {
    code: "operations.online-users",
    titleI18nKey: "routes.operations.onlineUsers",
    path: "/operations/online-users",
    parentCode: "operations",
    requiredPermission: "online-user:view",
    routeCode: "operations.online-users",
    sortOrder: 300
  },
  {
    code: "operations.scheduler",
    titleI18nKey: "routes.operations.scheduler",
    path: "/operations/scheduler",
    parentCode: "operations",
    requiredPermission: "job:view",
    routeCode: "operations.scheduler",
    sortOrder: 310
  },
  {
    code: "operations.import-export",
    titleI18nKey: "routes.operations.importExport",
    path: "/operations/import-export",
    parentCode: "operations",
    requiredPermission: "import-export:view",
    routeCode: "operations.import-export",
    sortOrder: 320
  },
  {
    code: "logs",
    titleI18nKey: "nav.logs",
    path: "/logs",
    sortOrder: 400
  },
  {
    code: "logs.login",
    titleI18nKey: "routes.logs.login",
    path: "/logs/login",
    parentCode: "logs",
    requiredPermission: "login-log:view",
    routeCode: "logs.login",
    sortOrder: 400
  },
  {
    code: "logs.operation",
    titleI18nKey: "routes.logs.operation",
    path: "/logs/operation",
    parentCode: "logs",
    requiredPermission: "operation-log:view",
    routeCode: "logs.operation",
    sortOrder: 401
  },
  {
    code: "logs.access",
    titleI18nKey: "routes.logs.access",
    path: "/logs/access",
    parentCode: "logs",
    requiredPermission: "access-log:view",
    routeCode: "logs.access",
    sortOrder: 402
  },
  {
    code: "logs.api",
    titleI18nKey: "routes.logs.api",
    path: "/logs/api",
    parentCode: "logs",
    requiredPermission: "api-log:view",
    routeCode: "logs.api",
    sortOrder: 403
  },
  {
    code: "logs.exception",
    titleI18nKey: "routes.logs.exception",
    path: "/logs/exception",
    parentCode: "logs",
    requiredPermission: "exception-log:view",
    routeCode: "logs.exception",
    sortOrder: 404
  },
  {
    code: "logs.security",
    titleI18nKey: "routes.logs.security",
    path: "/logs/security",
    parentCode: "logs",
    requiredPermission: "security-log:view",
    routeCode: "logs.security",
    sortOrder: 405
  },
  {
    code: "logs.scheduler",
    titleI18nKey: "routes.logs.scheduler",
    path: "/logs/scheduler",
    parentCode: "logs",
    requiredPermission: "scheduler-log:view",
    routeCode: "logs.scheduler",
    sortOrder: 406
  },
  {
    code: "logs.files",
    titleI18nKey: "routes.logs.files",
    path: "/logs/files",
    parentCode: "logs",
    requiredPermission: "file-log:view",
    routeCode: "logs.files",
    sortOrder: 407
  },
  {
    code: "account",
    titleI18nKey: "nav.account",
    path: "/account",
    sortOrder: 500
  },
  {
    code: "account.profile",
    titleI18nKey: "routes.account.profile",
    path: "/account/profile",
    parentCode: "account",
    routeCode: "account.profile",
    sortOrder: 500
  },
  {
    code: "account.password",
    titleI18nKey: "routes.account.password",
    path: "/account/password",
    parentCode: "account",
    routeCode: "account.password",
    sortOrder: 510
  },
  {
    code: "account.settings",
    titleI18nKey: "routes.account.settings",
    path: "/account/settings",
    parentCode: "account",
    routeCode: "account.settings",
    sortOrder: 520
  }
];
