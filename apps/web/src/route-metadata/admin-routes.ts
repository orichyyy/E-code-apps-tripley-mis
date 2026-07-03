import type { AdminRouteMetadata } from "@web-admin-base/contracts";

export type AdminRouteGroup = "system" | "notifications" | "operations" | "logs" | "account";

export type WebAdminRouteMetadata = AdminRouteMetadata & {
  group?: AdminRouteGroup;
  actions?: Array<{ code: string; labelI18nKey: string; requiredPermission?: string }>;
};

export const adminRoutes: WebAdminRouteMetadata[] = [
  { routeCode: "dashboard", path: "/", titleI18nKey: "routes.dashboard", menuVisible: true, sortOrder: 10 },
  {
    routeCode: "system.users",
    path: "/system/users",
    titleI18nKey: "routes.system.users",
    requiredPermission: "user:view",
    menuVisible: true,
    group: "system",
    sortOrder: 100,
    actions: [
      { code: "user:create", labelI18nKey: "actions.create", requiredPermission: "user:create" },
      { code: "user:export", labelI18nKey: "actions.export", requiredPermission: "user:export" }
    ]
  },
  {
    routeCode: "system.organizations",
    path: "/system/organizations",
    titleI18nKey: "routes.system.organizations",
    requiredPermission: "organization:view",
    menuVisible: true,
    group: "system",
    sortOrder: 110,
    actions: [{ code: "organization:create", labelI18nKey: "actions.create", requiredPermission: "organization:create" }]
  },
  {
    routeCode: "system.roles",
    path: "/system/roles",
    titleI18nKey: "routes.system.roles",
    requiredPermission: "role:view",
    menuVisible: true,
    group: "system",
    sortOrder: 120,
    actions: [{ code: "role:create", labelI18nKey: "actions.create", requiredPermission: "role:create" }]
  },
  {
    routeCode: "system.permissions",
    path: "/system/permissions",
    titleI18nKey: "routes.system.permissions",
    requiredPermission: "permission:view",
    menuVisible: true,
    group: "system",
    sortOrder: 130,
    actions: [{ code: "permission:sync", labelI18nKey: "actions.sync", requiredPermission: "permission:sync" }]
  },
  {
    routeCode: "system.menus",
    path: "/system/menus",
    titleI18nKey: "routes.system.menus",
    requiredPermission: "menu:view",
    menuVisible: true,
    group: "system",
    sortOrder: 140
  },
  {
    routeCode: "system.config",
    path: "/system/config",
    titleI18nKey: "routes.system.config",
    requiredPermission: "system-config:view",
    menuVisible: true,
    group: "system",
    sortOrder: 150
  },
  {
    routeCode: "system.dictionaries",
    path: "/system/dictionaries",
    titleI18nKey: "routes.system.dictionaries",
    requiredPermission: "dictionary:view",
    menuVisible: true,
    group: "system",
    sortOrder: 160
  },
  {
    routeCode: "system.i18nMessages",
    path: "/system/i18n-messages",
    titleI18nKey: "routes.system.i18nMessages",
    requiredPermission: "i18n:view",
    menuVisible: true,
    group: "system",
    sortOrder: 165,
    actions: [{ code: "i18n:update", labelI18nKey: "actions.edit", requiredPermission: "i18n:update" }]
  },
  {
    routeCode: "system.files",
    path: "/system/files",
    titleI18nKey: "routes.system.files",
    requiredPermission: "file:view",
    menuVisible: true,
    group: "system",
    sortOrder: 170
  },
  {
    routeCode: "notifications.announcements",
    path: "/notifications/announcements",
    titleI18nKey: "routes.notifications.announcements",
    requiredPermission: "announcement:view",
    menuVisible: true,
    group: "notifications",
    sortOrder: 200,
    actions: [
      { code: "announcement:create", labelI18nKey: "actions.create", requiredPermission: "announcement:create" },
      { code: "announcement:update", labelI18nKey: "actions.edit", requiredPermission: "announcement:update" },
      { code: "announcement:publish", labelI18nKey: "actions.publish", requiredPermission: "announcement:publish" }
    ]
  },
  {
    routeCode: "notifications.in-app",
    path: "/notifications/in-app",
    titleI18nKey: "routes.notifications.inApp",
    requiredPermission: "notification:view",
    menuVisible: true,
    group: "notifications",
    sortOrder: 210,
    actions: [{ code: "notification:update", labelI18nKey: "actions.edit", requiredPermission: "notification:update" }]
  },
  {
    routeCode: "notifications.templates",
    path: "/notifications/templates",
    titleI18nKey: "routes.notifications.templates",
    requiredPermission: "notification-template:view",
    menuVisible: true,
    group: "notifications",
    sortOrder: 215,
    actions: [
      { code: "notification-template:create", labelI18nKey: "actions.create", requiredPermission: "notification-template:create" },
      { code: "notification-template:update", labelI18nKey: "actions.edit", requiredPermission: "notification-template:update" }
    ]
  },
  {
    routeCode: "notifications.webhooks",
    path: "/notifications/webhooks",
    titleI18nKey: "routes.notifications.webhooks",
    requiredPermission: "webhook:view",
    menuVisible: true,
    group: "notifications",
    sortOrder: 220,
    actions: [
      { code: "webhook:create", labelI18nKey: "actions.create", requiredPermission: "webhook:create" },
      { code: "webhook:update", labelI18nKey: "actions.edit", requiredPermission: "webhook:update" }
    ]
  },
  {
    routeCode: "operations.online-users",
    path: "/operations/online-users",
    titleI18nKey: "routes.operations.onlineUsers",
    requiredPermission: "online-user:view",
    menuVisible: true,
    group: "operations",
    sortOrder: 300
  },
  {
    routeCode: "operations.scheduler",
    path: "/operations/scheduler",
    titleI18nKey: "routes.operations.scheduler",
    requiredPermission: "job:view",
    menuVisible: true,
    group: "operations",
    sortOrder: 310
  },
  {
    routeCode: "operations.import-export",
    path: "/operations/import-export",
    titleI18nKey: "routes.operations.importExport",
    requiredPermission: "import-export:view",
    menuVisible: true,
    group: "operations",
    sortOrder: 320
  },
  ...[
    ["logs.login", "/logs/login", "routes.logs.login", "login-log:view"],
    ["logs.operation", "/logs/operation", "routes.logs.operation", "operation-log:view"],
    ["logs.access", "/logs/access", "routes.logs.access", "access-log:view"],
    ["logs.api", "/logs/api", "routes.logs.api", "api-log:view"],
    ["logs.exception", "/logs/exception", "routes.logs.exception", "exception-log:view"],
    ["logs.security", "/logs/security", "routes.logs.security", "security-log:view"],
    ["logs.scheduler", "/logs/scheduler", "routes.logs.scheduler", "scheduler-log:view"],
    ["logs.files", "/logs/files", "routes.logs.files", "file-log:view"]
  ].map(
    ([routeCode, path, titleI18nKey, requiredPermission], index): WebAdminRouteMetadata => ({
      routeCode,
      path,
      titleI18nKey,
      requiredPermission,
      menuVisible: true,
      group: "logs",
      sortOrder: 400 + index
    })
  ),
  {
    routeCode: "account.profile",
    path: "/account/profile",
    titleI18nKey: "routes.account.profile",
    menuVisible: true,
    group: "account",
    sortOrder: 500
  },
  {
    routeCode: "account.password",
    path: "/account/password",
    titleI18nKey: "routes.account.password",
    menuVisible: true,
    group: "account",
    sortOrder: 510
  },
  {
    routeCode: "account.settings",
    path: "/account/settings",
    titleI18nKey: "routes.account.settings",
    menuVisible: true,
    group: "account",
    sortOrder: 520
  }
];
