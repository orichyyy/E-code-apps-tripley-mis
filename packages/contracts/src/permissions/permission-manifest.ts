export type PermissionManifestEntry = {
  code: string;
  description: string;
  module: string;
};

export const basePermissionManifest: PermissionManifestEntry[] = [
  { code: "organization:view", description: "View organization tree", module: "organizations" },
  { code: "organization:create", description: "Create organization", module: "organizations" },
  { code: "organization:update", description: "Update organization", module: "organizations" },
  { code: "organization:disable", description: "Disable organization", module: "organizations" },
  { code: "organization:enable", description: "Enable organization", module: "organizations" },
  { code: "organization:delete", description: "Soft delete organization", module: "organizations" },
  { code: "user:view", description: "View users", module: "users" },
  { code: "user:create", description: "Create user", module: "users" },
  { code: "user:update", description: "Update user", module: "users" },
  { code: "user:disable", description: "Disable user", module: "users" },
  { code: "user:enable", description: "Enable user", module: "users" },
  { code: "user:lock", description: "Lock user", module: "users" },
  { code: "user:unlock", description: "Unlock user", module: "users" },
  { code: "user:password:reset", description: "Administrator reset password", module: "users" },
  { code: "user:delete", description: "Soft delete user", module: "users" },
  { code: "role:view", description: "View roles", module: "roles" },
  { code: "role:create", description: "Create role", module: "roles" },
  { code: "role:update", description: "Update role", module: "roles" },
  { code: "role:copy", description: "Copy role", module: "roles" },
  { code: "role:permissions:update", description: "Update role permissions", module: "roles" },
  { code: "role:status:update", description: "Enable or disable role", module: "roles" },
  { code: "role:delete", description: "Soft delete role", module: "roles" },
  { code: "permission:view", description: "View permissions", module: "permissions" },
  { code: "permission:sync", description: "Sync permission manifest", module: "permissions" },
  { code: "menu:view", description: "View menu tree", module: "menus" },
  { code: "menu:create", description: "Create menu", module: "menus" },
  { code: "menu:update", description: "Update menu", module: "menus" },
  { code: "menu:delete", description: "Delete menu", module: "menus" },
  { code: "route:manifest:view", description: "View route manifest", module: "routes" },
  { code: "route:sync", description: "Sync route manifest", module: "routes" },
  { code: "online-user:view", description: "View online users", module: "auth" }
];
