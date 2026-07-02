export type ApiPermissionLogLevel = "none" | "basic" | "request" | "request_response";

export type BaseApiPermissionManifestEntry = {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  code: string;
  description: string;
  module: string;
  requiredPermission?: string;
  logLevel: ApiPermissionLogLevel;
  public: boolean;
};

export const baseApiPermissionManifest: BaseApiPermissionManifestEntry[] = [
  {
    method: "GET",
    path: "/api/health",
    code: "api.health.view",
    description: "Health check",
    module: "observability",
    logLevel: "none",
    public: true
  },
  {
    method: "GET",
    path: "/api/initialization/status",
    code: "api.initialization.status",
    description: "Check initialization status",
    module: "initialization",
    logLevel: "basic",
    public: true
  },
  {
    method: "POST",
    path: "/api/initialization/setup",
    code: "api.initialization.setup",
    description: "Run first-start initialization setup",
    module: "initialization",
    logLevel: "request",
    public: true
  },
  {
    method: "POST",
    path: "/api/auth/login",
    code: "api.auth.login",
    description: "Username and password login",
    module: "auth",
    logLevel: "request",
    public: true
  },
  {
    method: "POST",
    path: "/api/auth/refresh",
    code: "api.auth.refresh",
    description: "Refresh access token from refresh-token cookie",
    module: "auth",
    logLevel: "basic",
    public: true
  },
  {
    method: "GET",
    path: "/api/auth/me",
    code: "api.auth.me",
    description: "Get current user profile, organization context, and permissions summary",
    module: "auth",
    logLevel: "basic",
    public: false
  },
  {
    method: "POST",
    path: "/api/auth/logout",
    code: "api.auth.logout",
    description: "Logout and revoke current session",
    module: "auth",
    logLevel: "basic",
    public: false
  },
  {
    method: "POST",
    path: "/api/auth/change-password",
    code: "api.auth.change-password",
    description: "Change current user's password",
    module: "auth",
    logLevel: "request",
    public: false
  },
  {
    method: "POST",
    path: "/api/context/current-organization",
    code: "api.context.current-organization.switch",
    description: "Switch current organization and refresh permission context",
    module: "auth",
    logLevel: "request",
    public: false
  },
  {
    method: "GET",
    path: "/api/context/organizations",
    code: "api.context.organizations.list",
    description: "List organizations available to the current user",
    module: "auth",
    logLevel: "basic",
    public: false
  },
  {
    method: "GET",
    path: "/api/context/permissions",
    code: "api.context.permissions",
    description: "Get current permission and menu context",
    module: "auth",
    logLevel: "basic",
    public: false
  },
  {
    method: "GET",
    path: "/api/online-users",
    code: "api.online-users.view",
    description: "View online users",
    module: "auth",
    requiredPermission: "online-user:view",
    logLevel: "basic",
    public: false
  },
  {
    method: "GET",
    path: "/api/organizations/tree",
    code: "api.organizations.tree",
    description: "View organization tree",
    module: "organizations",
    requiredPermission: "organization:view",
    logLevel: "basic",
    public: false
  },
  {
    method: "POST",
    path: "/api/organizations",
    code: "api.organizations.create",
    description: "Create organization",
    module: "organizations",
    requiredPermission: "organization:create",
    logLevel: "request",
    public: false
  },
  {
    method: "GET",
    path: "/api/organizations/:id",
    code: "api.organizations.detail",
    description: "View organization detail",
    module: "organizations",
    requiredPermission: "organization:view",
    logLevel: "basic",
    public: false
  },
  {
    method: "PATCH",
    path: "/api/organizations/:id",
    code: "api.organizations.update",
    description: "Update organization",
    module: "organizations",
    requiredPermission: "organization:update",
    logLevel: "request",
    public: false
  },
  {
    method: "POST",
    path: "/api/organizations/:id/disable",
    code: "api.organizations.disable",
    description: "Disable organization and descendants",
    module: "organizations",
    requiredPermission: "organization:disable",
    logLevel: "request",
    public: false
  },
  {
    method: "POST",
    path: "/api/organizations/:id/enable",
    code: "api.organizations.enable",
    description: "Enable organization",
    module: "organizations",
    requiredPermission: "organization:enable",
    logLevel: "request",
    public: false
  },
  {
    method: "DELETE",
    path: "/api/organizations/:id",
    code: "api.organizations.delete",
    description: "Soft delete organization",
    module: "organizations",
    requiredPermission: "organization:delete",
    logLevel: "request",
    public: false
  },
  {
    method: "GET",
    path: "/api/users",
    code: "api.users.list",
    description: "View users",
    module: "users",
    requiredPermission: "user:view",
    logLevel: "basic",
    public: false
  },
  {
    method: "POST",
    path: "/api/users",
    code: "api.users.create",
    description: "Create user",
    module: "users",
    requiredPermission: "user:create",
    logLevel: "request",
    public: false
  },
  {
    method: "GET",
    path: "/api/users/:id",
    code: "api.users.detail",
    description: "View user detail",
    module: "users",
    requiredPermission: "user:view",
    logLevel: "basic",
    public: false
  },
  {
    method: "PATCH",
    path: "/api/users/:id",
    code: "api.users.update",
    description: "Update user",
    module: "users",
    requiredPermission: "user:update",
    logLevel: "request",
    public: false
  },
  {
    method: "POST",
    path: "/api/users/:id/disable",
    code: "api.users.disable",
    description: "Disable user",
    module: "users",
    requiredPermission: "user:disable",
    logLevel: "request",
    public: false
  },
  {
    method: "POST",
    path: "/api/users/:id/enable",
    code: "api.users.enable",
    description: "Enable user",
    module: "users",
    requiredPermission: "user:enable",
    logLevel: "request",
    public: false
  },
  {
    method: "POST",
    path: "/api/users/:id/lock",
    code: "api.users.lock",
    description: "Lock user",
    module: "users",
    requiredPermission: "user:lock",
    logLevel: "request",
    public: false
  },
  {
    method: "POST",
    path: "/api/users/:id/unlock",
    code: "api.users.unlock",
    description: "Unlock user",
    module: "users",
    requiredPermission: "user:unlock",
    logLevel: "request",
    public: false
  },
  {
    method: "POST",
    path: "/api/users/:id/reset-password",
    code: "api.users.password.reset",
    description: "Administrator resets user password",
    module: "users",
    requiredPermission: "user:password:reset",
    logLevel: "request",
    public: false
  },
  {
    method: "DELETE",
    path: "/api/users/:id",
    code: "api.users.delete",
    description: "Soft delete user",
    module: "users",
    requiredPermission: "user:delete",
    logLevel: "request",
    public: false
  },
  {
    method: "GET",
    path: "/api/users/:id/organizations",
    code: "api.users.organizations.list",
    description: "View user organization role bindings",
    module: "users",
    requiredPermission: "user:view",
    logLevel: "basic",
    public: false
  },
  {
    method: "POST",
    path: "/api/users/:id/organizations",
    code: "api.users.organizations.assign",
    description: "Assign user to organization with role",
    module: "users",
    requiredPermission: "user:update",
    logLevel: "request",
    public: false
  },
  {
    method: "DELETE",
    path: "/api/users/:id/organizations/:organizationId",
    code: "api.users.organizations.remove",
    description: "Remove user organization role binding",
    module: "users",
    requiredPermission: "user:update",
    logLevel: "request",
    public: false
  },
  {
    method: "GET",
    path: "/api/roles",
    code: "api.roles.list",
    description: "View roles",
    module: "roles",
    requiredPermission: "role:view",
    logLevel: "basic",
    public: false
  },
  {
    method: "POST",
    path: "/api/roles",
    code: "api.roles.create",
    description: "Create role",
    module: "roles",
    requiredPermission: "role:create",
    logLevel: "request",
    public: false
  },
  {
    method: "GET",
    path: "/api/roles/:id",
    code: "api.roles.detail",
    description: "View role detail",
    module: "roles",
    requiredPermission: "role:view",
    logLevel: "basic",
    public: false
  },
  {
    method: "PATCH",
    path: "/api/roles/:id",
    code: "api.roles.update",
    description: "Update role",
    module: "roles",
    requiredPermission: "role:update",
    logLevel: "request",
    public: false
  },
  {
    method: "POST",
    path: "/api/roles/:id/enable",
    code: "api.roles.enable",
    description: "Enable role",
    module: "roles",
    requiredPermission: "role:status:update",
    logLevel: "request",
    public: false
  },
  {
    method: "POST",
    path: "/api/roles/:id/disable",
    code: "api.roles.disable",
    description: "Disable role",
    module: "roles",
    requiredPermission: "role:status:update",
    logLevel: "request",
    public: false
  },
  {
    method: "DELETE",
    path: "/api/roles/:id",
    code: "api.roles.delete",
    description: "Soft delete role",
    module: "roles",
    requiredPermission: "role:delete",
    logLevel: "request",
    public: false
  },
  {
    method: "POST",
    path: "/api/roles/:id/copy",
    code: "api.roles.copy",
    description: "Copy role and permission configuration",
    module: "roles",
    requiredPermission: "role:copy",
    logLevel: "request",
    public: false
  },
  {
    method: "GET",
    path: "/api/roles/:id/permissions",
    code: "api.roles.permissions.view",
    description: "View role permission configuration",
    module: "roles",
    requiredPermission: "role:view",
    logLevel: "basic",
    public: false
  },
  {
    method: "PUT",
    path: "/api/roles/:id/permissions",
    code: "api.roles.permissions.update",
    description: "Update role permissions",
    module: "roles",
    requiredPermission: "role:permissions:update",
    logLevel: "request",
    public: false
  },
  {
    method: "GET",
    path: "/api/permissions",
    code: "api.permissions.list",
    description: "View permissions",
    module: "permissions",
    requiredPermission: "permission:view",
    logLevel: "basic",
    public: false
  },
  {
    method: "POST",
    path: "/api/permissions/sync",
    code: "api.permissions.sync",
    description: "Sync permission and API permission manifests",
    module: "permissions",
    requiredPermission: "permission:sync",
    logLevel: "request",
    public: false
  },
  {
    method: "GET",
    path: "/api/permissions/api",
    code: "api.permissions.api.list",
    description: "Query API permission identifiers",
    module: "permissions",
    requiredPermission: "permission:view",
    logLevel: "basic",
    public: false
  },
  {
    method: "POST",
    path: "/api/permissions/api/sync",
    code: "api.permissions.api.sync",
    description: "Sync API permission identifiers",
    module: "permissions",
    requiredPermission: "permission:api:sync",
    logLevel: "request",
    public: false
  },
  {
    method: "GET",
    path: "/api/permissions/manifest",
    code: "api.permissions.manifest",
    description: "Preview generated permission manifest",
    module: "permissions",
    requiredPermission: "permission:view",
    logLevel: "basic",
    public: false
  },
  {
    method: "GET",
    path: "/api/routes/manifest",
    code: "api.routes.manifest",
    description: "View frontend route manifest",
    module: "routes",
    requiredPermission: "route:manifest:view",
    logLevel: "basic",
    public: false
  },
  {
    method: "POST",
    path: "/api/routes/sync",
    code: "api.routes.sync",
    description: "Sync frontend route manifest metadata",
    module: "routes",
    requiredPermission: "route:sync",
    logLevel: "request",
    public: false
  },
  {
    method: "GET",
    path: "/api/menus/tree",
    code: "api.menus.tree",
    description: "View menu tree",
    module: "menus",
    requiredPermission: "menu:view",
    logLevel: "basic",
    public: false
  },
  {
    method: "POST",
    path: "/api/menus",
    code: "api.menus.create",
    description: "Create menu",
    module: "menus",
    requiredPermission: "menu:create",
    logLevel: "request",
    public: false
  },
  {
    method: "PATCH",
    path: "/api/menus/:id",
    code: "api.menus.update",
    description: "Update menu",
    module: "menus",
    requiredPermission: "menu:update",
    logLevel: "request",
    public: false
  },
  {
    method: "DELETE",
    path: "/api/menus/:id",
    code: "api.menus.delete",
    description: "Delete menu",
    module: "menus",
    requiredPermission: "menu:delete",
    logLevel: "request",
    public: false
  }
];
