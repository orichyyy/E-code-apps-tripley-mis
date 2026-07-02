import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
};

const softDelete = {
  isDeleted: integer("is_deleted", { mode: "boolean" }).notNull().default(false),
  deletedAt: text("deleted_at"),
  deletedBy: integer("deleted_by")
};

export const schemaMetadata = sqliteTable("schema_metadata", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  value: text("value", { mode: "json" }),
  ...timestamps
});

export const organizations = sqliteTable(
  "organizations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id"),
    path: integer("path").notNull(),
    level: integer("level").notNull(),
    segment: integer("segment").notNull(),
    name: text("name").notNull(),
    code: text("code").notNull(),
    managerUserId: integer("manager_user_id"),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    sortOrder: integer("sort_order").notNull().default(0),
    status: text("status", { enum: ["enabled", "disabled"] }).notNull().default("enabled"),
    remark: text("remark"),
    ...softDelete,
    ...timestamps,
    createdBy: integer("created_by"),
    updatedBy: integer("updated_by")
  },
  (table) => ({
    codeUnique: uniqueIndex("organizations_code_unique").on(table.code),
    pathUnique: uniqueIndex("organizations_path_unique").on(table.path)
  })
);

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id"),
    username: text("username").notNull(),
    displayName: text("display_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    avatarFileId: integer("avatar_file_id"),
    gender: text("gender"),
    employeeNumber: text("employee_number"),
    passwordHash: text("password_hash").notNull(),
    primaryOrganizationId: integer("primary_organization_id"),
    status: text("status", { enum: ["enabled", "disabled", "locked"] }).notNull().default("enabled"),
    firstLoginPasswordChangeRequired: integer("first_login_password_change_required", {
      mode: "boolean"
    })
      .notNull()
      .default(true),
    passwordChangedAt: text("password_changed_at"),
    passwordExpiresAt: text("password_expires_at"),
    failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
    lockedUntil: text("locked_until"),
    tokenVersion: integer("token_version").notNull().default(0),
    lastLoginAt: text("last_login_at"),
    remark: text("remark"),
    ...softDelete,
    ...timestamps,
    createdBy: integer("created_by"),
    updatedBy: integer("updated_by")
  },
  (table) => ({
    usernameUnique: uniqueIndex("users_username_unique").on(table.username),
    emailUnique: uniqueIndex("users_email_unique").on(table.email),
    phoneUnique: uniqueIndex("users_phone_unique").on(table.phone)
  })
);

export const roles = sqliteTable(
  "roles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id"),
    name: text("name").notNull(),
    code: text("code").notNull(),
    description: text("description"),
    dataScopeRuleId: integer("data_scope_rule_id"),
    isBuiltin: integer("is_builtin", { mode: "boolean" }).notNull().default(false),
    status: text("status", { enum: ["enabled", "disabled"] }).notNull().default("enabled"),
    remark: text("remark"),
    ...softDelete,
    ...timestamps,
    createdBy: integer("created_by"),
    updatedBy: integer("updated_by")
  },
  (table) => ({
    codeUnique: uniqueIndex("roles_code_unique").on(table.code)
  })
);

export const userOrganizationRoles = sqliteTable(
  "user_organization_roles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id"),
    userId: integer("user_id").notNull(),
    organizationId: integer("organization_id").notNull(),
    roleId: integer("role_id").notNull(),
    isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
    status: text("status", { enum: ["enabled", "disabled"] }).notNull().default("enabled"),
    ...softDelete,
    ...timestamps,
    createdBy: integer("created_by"),
    updatedBy: integer("updated_by")
  },
  (table) => ({
    userOrgUnique: uniqueIndex("user_organization_roles_user_org_unique").on(
      table.userId,
      table.organizationId
    )
  })
);

export const permissions = sqliteTable(
  "permissions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id"),
    code: text("code").notNull(),
    name: text("name").notNull(),
    permissionType: text("permission_type", {
      enum: ["menu", "page", "action", "api", "data", "field"]
    }).notNull(),
    description: text("description"),
    module: text("module").notNull(),
    status: text("status", { enum: ["enabled", "disabled"] }).notNull().default("enabled"),
    ...timestamps
  },
  (table) => ({
    codeUnique: uniqueIndex("permissions_code_unique").on(table.code)
  })
);

export const rolePermissions = sqliteTable(
  "role_permissions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id"),
    roleId: integer("role_id").notNull(),
    permissionId: integer("permission_id").notNull(),
    effect: text("effect", { enum: ["allow", "deny"] }).notNull().default("allow"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => ({
    rolePermissionUnique: uniqueIndex("role_permissions_role_permission_unique").on(
      table.roleId,
      table.permissionId
    )
  })
);

export const menus = sqliteTable(
  "menus",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id"),
    parentMenuId: integer("parent_menu_id"),
    permissionId: integer("permission_id"),
    code: text("code").notNull(),
    routeCode: text("route_code"),
    titleI18nKey: text("title_i18n_key").notNull(),
    path: text("path").notNull(),
    icon: text("icon"),
    sortOrder: integer("sort_order").notNull().default(0),
    status: text("status", { enum: ["enabled", "disabled"] }).notNull().default("enabled"),
    ...softDelete,
    ...timestamps
  },
  (table) => ({
    codeUnique: uniqueIndex("menus_code_unique").on(table.code),
    pathUnique: uniqueIndex("menus_path_unique").on(table.path)
  })
);

export const routeMetadata = sqliteTable(
  "route_metadata",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id"),
    routeCode: text("route_code").notNull(),
    path: text("path").notNull(),
    titleI18nKey: text("title_i18n_key").notNull(),
    requiredPermission: text("required_permission"),
    menuVisible: integer("menu_visible", { mode: "boolean" }).notNull().default(true),
    icon: text("icon"),
    sortOrder: integer("sort_order").notNull().default(0),
    status: text("status", { enum: ["enabled", "disabled"] }).notNull().default("enabled"),
    ...timestamps
  },
  (table) => ({
    routeCodeUnique: uniqueIndex("route_metadata_route_code_unique").on(table.routeCode)
  })
);

export const apiPermissions = sqliteTable(
  "api_permissions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id"),
    method: text("method").notNull(),
    path: text("path").notNull(),
    code: text("code").notNull(),
    description: text("description"),
    module: text("module").notNull(),
    requiredPermission: text("required_permission"),
    logLevel: text("log_level", { enum: ["none", "basic", "request", "request_response"] })
      .notNull()
      .default("basic"),
    public: integer("public", { mode: "boolean" }).notNull().default(false),
    status: text("status", { enum: ["enabled", "disabled"] }).notNull().default("enabled"),
    ...timestamps
  },
  (table) => ({
    codeUnique: uniqueIndex("api_permissions_code_unique").on(table.code),
    methodPathUnique: uniqueIndex("api_permissions_method_path_unique").on(table.method, table.path)
  })
);

export const menuApiBindings = sqliteTable(
  "menu_api_bindings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id"),
    menuId: integer("menu_id").notNull(),
    apiPermissionId: integer("api_permission_id").notNull(),
    createdAt: text("created_at").notNull()
  },
  (table) => ({
    bindingUnique: uniqueIndex("menu_api_bindings_unique").on(table.menuId, table.apiPermissionId)
  })
);

export const authSessions = sqliteTable("auth_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenantId: integer("tenant_id"),
  userId: integer("user_id").notNull(),
  refreshTokenHash: text("refresh_token_hash").notNull(),
  currentOrganizationId: integer("current_organization_id").notNull(),
  tokenVersion: integer("token_version").notNull(),
  status: text("status", { enum: ["active", "revoked", "expired"] }).notNull().default("active"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  expiresAt: text("expires_at").notNull(),
  revokedAt: text("revoked_at"),
  createdAt: text("created_at").notNull(),
  lastSeenAt: text("last_seen_at").notNull()
});

export const refreshTokens = sqliteTable(
  "refresh_tokens",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id"),
    sessionId: integer("session_id").notNull(),
    userId: integer("user_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    tokenVersion: integer("token_version").notNull(),
    expiresAt: text("expires_at").notNull(),
    revokedAt: text("revoked_at"),
    createdAt: text("created_at").notNull()
  },
  (table) => ({
    tokenHashUnique: uniqueIndex("refresh_tokens_hash_unique").on(table.tokenHash)
  })
);

export const systemInitializationState = sqliteTable("system_initialization_state", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenantId: integer("tenant_id"),
  status: text("status", { enum: ["uninitialized", "initialized"] }).notNull(),
  initializedAt: text("initialized_at"),
  initializedBy: integer("initialized_by"),
  version: text("version").notNull(),
  ...timestamps
});

export const sqliteSchema = {
  apiPermissions,
  authSessions,
  menuApiBindings,
  menus,
  organizations,
  permissions,
  refreshTokens,
  rolePermissions,
  roles,
  routeMetadata,
  schemaMetadata,
  systemInitializationState,
  userOrganizationRoles,
  users
};
