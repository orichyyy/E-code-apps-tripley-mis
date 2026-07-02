import {
  bigint,
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
};

const softDelete = {
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletedBy: integer("deleted_by")
};

export const schemaMetadata = pgTable("schema_metadata", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: jsonb("value"),
  ...timestamps
});

export const organizations = pgTable(
  "organizations",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id"),
    path: bigint("path", { mode: "bigint" }).notNull(),
    level: integer("level").notNull(),
    segment: integer("segment").notNull(),
    name: text("name").notNull(),
    code: text("code").notNull(),
    managerUserId: integer("manager_user_id"),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    sortOrder: integer("sort_order").notNull().default(0),
    status: text("status").notNull().default("enabled"),
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

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
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
    status: text("status").notNull().default("enabled"),
    firstLoginPasswordChangeRequired: boolean("first_login_password_change_required")
      .notNull()
      .default(true),
    passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }),
    passwordExpiresAt: timestamp("password_expires_at", { withTimezone: true }),
    failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    tokenVersion: integer("token_version").notNull().default(0),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
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

export const roles = pgTable(
  "roles",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id"),
    name: text("name").notNull(),
    code: text("code").notNull(),
    status: text("status").notNull().default("enabled"),
    remark: text("remark"),
    ...softDelete,
    ...timestamps
  },
  (table) => ({
    codeUnique: uniqueIndex("roles_code_unique").on(table.code)
  })
);

export const userOrganizationRoles = pgTable(
  "user_organization_roles",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id"),
    userId: integer("user_id").notNull(),
    organizationId: integer("organization_id").notNull(),
    roleId: integer("role_id").notNull(),
    ...softDelete,
    ...timestamps
  },
  (table) => ({
    userOrgUnique: uniqueIndex("user_organization_roles_user_org_unique").on(
      table.userId,
      table.organizationId
    )
  })
);

export const permissions = pgTable(
  "permissions",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id"),
    code: text("code").notNull(),
    name: text("name").notNull(),
    permissionType: text("permission_type").notNull(),
    description: text("description"),
    module: text("module").notNull(),
    status: text("status").notNull().default("enabled"),
    ...timestamps
  },
  (table) => ({
    codeUnique: uniqueIndex("permissions_code_unique").on(table.code)
  })
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id"),
    roleId: integer("role_id").notNull(),
    permissionId: integer("permission_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull()
  },
  (table) => ({
    rolePermissionUnique: uniqueIndex("role_permissions_role_permission_unique").on(
      table.roleId,
      table.permissionId
    )
  })
);

export const menus = pgTable(
  "menus",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id"),
    parentMenuId: integer("parent_menu_id"),
    permissionId: integer("permission_id"),
    code: text("code").notNull(),
    routeCode: text("route_code"),
    titleI18nKey: text("title_i18n_key").notNull(),
    path: text("path").notNull(),
    icon: text("icon"),
    sortOrder: integer("sort_order").notNull().default(0),
    status: text("status").notNull().default("enabled"),
    ...softDelete,
    ...timestamps
  },
  (table) => ({
    codeUnique: uniqueIndex("menus_code_unique").on(table.code),
    pathUnique: uniqueIndex("menus_path_unique").on(table.path)
  })
);

export const routeMetadata = pgTable(
  "route_metadata",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id"),
    routeCode: text("route_code").notNull(),
    path: text("path").notNull(),
    titleI18nKey: text("title_i18n_key").notNull(),
    requiredPermission: text("required_permission"),
    menuVisible: boolean("menu_visible").notNull().default(true),
    icon: text("icon"),
    sortOrder: integer("sort_order").notNull().default(0),
    status: text("status").notNull().default("enabled"),
    ...timestamps
  },
  (table) => ({
    routeCodeUnique: uniqueIndex("route_metadata_route_code_unique").on(table.routeCode)
  })
);

export const apiPermissions = pgTable(
  "api_permissions",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id"),
    method: text("method").notNull(),
    path: text("path").notNull(),
    code: text("code").notNull(),
    description: text("description"),
    module: text("module").notNull(),
    requiredPermission: text("required_permission"),
    logLevel: text("log_level").notNull().default("basic"),
    public: boolean("public").notNull().default(false),
    status: text("status").notNull().default("enabled"),
    ...timestamps
  },
  (table) => ({
    codeUnique: uniqueIndex("api_permissions_code_unique").on(table.code),
    methodPathUnique: uniqueIndex("api_permissions_method_path_unique").on(table.method, table.path)
  })
);

export const menuApiBindings = pgTable(
  "menu_api_bindings",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id"),
    menuId: integer("menu_id").notNull(),
    apiPermissionId: integer("api_permission_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull()
  },
  (table) => ({
    bindingUnique: uniqueIndex("menu_api_bindings_unique").on(table.menuId, table.apiPermissionId)
  })
);

export const authSessions = pgTable("auth_sessions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id"),
  userId: integer("user_id").notNull(),
  refreshTokenHash: text("refresh_token_hash").notNull(),
  currentOrganizationId: integer("current_organization_id").notNull(),
  tokenVersion: integer("token_version").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull()
});

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id"),
    sessionId: integer("session_id").notNull(),
    userId: integer("user_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    tokenVersion: integer("token_version").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull()
  },
  (table) => ({
    tokenHashUnique: uniqueIndex("refresh_tokens_hash_unique").on(table.tokenHash)
  })
);

export const systemInitializationState = pgTable("system_initialization_state", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id"),
  status: text("status").notNull(),
  initializedAt: timestamp("initialized_at", { withTimezone: true }),
  initializedBy: integer("initialized_by"),
  version: text("version").notNull(),
  ...timestamps
});

export const postgresqlSchema = {
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
