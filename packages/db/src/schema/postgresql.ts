import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
};

const softDelete = {
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletedBy: integer("deleted_by"),
};

export const schemaMetadata = pgTable("schema_metadata", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: jsonb("value"),
  ...timestamps,
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
    updatedBy: integer("updated_by"),
  },
  (table) => ({
    codeUnique: uniqueIndex("organizations_code_unique").on(table.code),
    pathLevelIndex: index("organizations_path_level_idx").on(table.path, table.level),
    pathUnique: uniqueIndex("organizations_path_unique").on(table.path),
    levelCheck: check("organizations_level_check", sql`${table.level} BETWEEN 1 AND 8`),
    rootSegmentCheck: check(
      "organizations_root_segment_check",
      sql`${table.level} <> 1 OR ${table.segment} BETWEEN 1 AND 127`,
    ),
    segmentCheck: check("organizations_segment_check", sql`${table.segment} BETWEEN 1 AND 255`),
    statusCheck: check(
      "organizations_status_check",
      sql`${table.status} IN ('enabled', 'disabled')`,
    ),
  }),
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
    updatedBy: integer("updated_by"),
  },
  (table) => ({
    usernameUnique: uniqueIndex("users_username_unique").on(table.username),
    emailUnique: uniqueIndex("users_email_unique").on(table.email),
    phoneUnique: uniqueIndex("users_phone_unique").on(table.phone),
    statusCheck: check(
      "users_status_check",
      sql`${table.status} IN ('enabled', 'disabled', 'locked')`,
    ),
  }),
);

export const userPreferences = pgTable(
  "user_preferences",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id"),
    userId: integer("user_id").notNull(),
    language: text("language").notNull().default("en"),
    themeMode: text("theme_mode").notNull().default("light"),
    themeColor: text("theme_color").notNull().default("blue"),
    pageTabsEnabled: boolean("page_tabs_enabled").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    userUnique: uniqueIndex("user_preferences_user_unique").on(table.userId),
    languageCheck: check("user_preferences_language_check", sql`${table.language} IN ('en', 'zh')`),
    themeModeCheck: check(
      "user_preferences_theme_mode_check",
      sql`${table.themeMode} IN ('light', 'dark')`,
    ),
    themeColorCheck: check(
      "user_preferences_theme_color_check",
      sql`${table.themeColor} IN ('blue', 'emerald', 'violet', 'slate')`,
    ),
  }),
);

export const roles = pgTable(
  "roles",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id"),
    name: text("name").notNull(),
    code: text("code").notNull(),
    description: text("description"),
    dataScopeRuleId: integer("data_scope_rule_id"),
    isBuiltin: boolean("is_builtin").notNull().default(false),
    status: text("status").notNull().default("enabled"),
    remark: text("remark"),
    ...softDelete,
    ...timestamps,
    createdBy: integer("created_by"),
    updatedBy: integer("updated_by"),
  },
  (table) => ({
    codeUnique: uniqueIndex("roles_code_unique").on(table.code),
    statusCheck: check("roles_status_check", sql`${table.status} IN ('enabled', 'disabled')`),
  }),
);

export const userOrganizationRoles = pgTable(
  "user_organization_roles",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id"),
    userId: integer("user_id").notNull(),
    organizationId: integer("organization_id").notNull(),
    roleId: integer("role_id").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    status: text("status").notNull().default("enabled"),
    ...softDelete,
    ...timestamps,
    createdBy: integer("created_by"),
    updatedBy: integer("updated_by"),
  },
  (table) => ({
    userOrgUnique: uniqueIndex("user_organization_roles_user_org_unique").on(
      table.userId,
      table.organizationId,
    ),
    statusCheck: check(
      "user_organization_roles_status_check",
      sql`${table.status} IN ('enabled', 'disabled')`,
    ),
  }),
);

export const permissions = pgTable(
  "permissions",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id"),
    code: text("code").notNull(),
    name: text("name").notNull(),
    permissionType: text("permission_type").notNull(),
    resource: text("resource").notNull(),
    action: text("action").notNull(),
    description: text("description"),
    module: text("module").notNull(),
    source: text("source").notNull().default("base_manifest"),
    manifestHash: text("manifest_hash").notNull(),
    status: text("status").notNull().default("enabled"),
    ...timestamps,
  },
  (table) => ({
    codeUnique: uniqueIndex("permissions_code_unique").on(table.code),
    statusCheck: check("permissions_status_check", sql`${table.status} IN ('enabled', 'disabled')`),
    typeCheck: check(
      "permissions_type_check",
      sql`${table.permissionType} IN ('menu', 'page', 'action', 'api', 'data', 'field')`,
    ),
  }),
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id"),
    roleId: integer("role_id").notNull(),
    permissionId: integer("permission_id").notNull(),
    effect: text("effect").notNull().default("allow"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    rolePermissionUnique: uniqueIndex("role_permissions_role_permission_unique").on(
      table.roleId,
      table.permissionId,
    ),
    effectCheck: check("role_permissions_effect_check", sql`${table.effect} IN ('allow', 'deny')`),
  }),
);

export const roleDataPermissions = pgTable(
  "role_data_permissions",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id"),
    roleId: integer("role_id").notNull(),
    permissionId: integer("permission_id").notNull(),
    effect: text("effect").notNull().default("allow"),
    ruleJson: jsonb("rule_json").notNull(),
    ...softDelete,
    ...timestamps,
    createdBy: integer("created_by"),
    updatedBy: integer("updated_by"),
  },
  (table) => ({
    roleDataPermissionUnique: uniqueIndex("role_data_permissions_role_permission_unique").on(
      table.roleId,
      table.permissionId,
    ),
    effectCheck: check(
      "role_data_permissions_effect_check",
      sql`${table.effect} IN ('allow', 'deny')`,
    ),
  }),
);

export const fieldPermissionRules = pgTable(
  "field_permission_rules",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id"),
    targetType: text("target_type").notNull(),
    targetId: integer("target_id").notNull(),
    resource: text("resource").notNull(),
    field: text("field").notNull(),
    effect: text("effect").notNull(),
    ...softDelete,
    ...timestamps,
    createdBy: integer("created_by"),
    updatedBy: integer("updated_by"),
  },
  (table) => ({
    targetFieldUnique: uniqueIndex("field_permission_rules_target_field_unique").on(
      table.targetType,
      table.targetId,
      table.resource,
      table.field,
    ),
    targetTypeCheck: check(
      "field_permission_rules_target_type_check",
      sql`${table.targetType} IN ('role')`,
    ),
    effectCheck: check(
      "field_permission_rules_effect_check",
      sql`${table.effect} IN ('visible', 'hidden', 'readonly')`,
    ),
  }),
);

export const userPermissionOverrides = pgTable(
  "user_permission_overrides",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id"),
    userId: integer("user_id").notNull(),
    permissionId: integer("permission_id").notNull(),
    effect: text("effect").notNull(),
    ...softDelete,
    ...timestamps,
    createdBy: integer("created_by"),
    updatedBy: integer("updated_by"),
  },
  (table) => ({
    userPermissionUnique: uniqueIndex("user_permission_overrides_user_permission_unique").on(
      table.userId,
      table.permissionId,
    ),
    effectCheck: check(
      "user_permission_overrides_effect_check",
      sql`${table.effect} IN ('allow', 'deny')`,
    ),
  }),
);

export const menus = pgTable(
  "menus",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id"),
    parentMenuId: integer("parent_menu_id"),
    permissionCode: text("permission_code"),
    code: text("code").notNull(),
    routeCode: text("route_code"),
    titleI18nKey: text("title_i18n_key").notNull(),
    path: text("path").notNull(),
    icon: text("icon"),
    sortOrder: integer("sort_order").notNull().default(0),
    visible: boolean("visible").notNull().default(true),
    status: text("status").notNull().default("enabled"),
    ...softDelete,
    ...timestamps,
  },
  (table) => ({
    codeUnique: uniqueIndex("menus_code_unique").on(table.code),
    pathUnique: uniqueIndex("menus_path_unique").on(table.path),
    statusCheck: check("menus_status_check", sql`${table.status} IN ('enabled', 'disabled')`),
  }),
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
    metadataJson: jsonb("metadata_json").notNull(),
    manifestHash: text("manifest_hash").notNull(),
    menuVisible: boolean("menu_visible").notNull().default(true),
    icon: text("icon"),
    sortOrder: integer("sort_order").notNull().default(0),
    status: text("status").notNull().default("enabled"),
    ...timestamps,
  },
  (table) => ({
    routeCodeUnique: uniqueIndex("route_metadata_route_code_unique").on(table.routeCode),
    statusCheck: check(
      "route_metadata_status_check",
      sql`${table.status} IN ('enabled', 'disabled')`,
    ),
  }),
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
    ...timestamps,
  },
  (table) => ({
    codeUnique: uniqueIndex("api_permissions_code_unique").on(table.code),
    methodPathUnique: uniqueIndex("api_permissions_method_path_unique").on(
      table.method,
      table.path,
    ),
    logLevelCheck: check(
      "api_permissions_log_level_check",
      sql`${table.logLevel} IN ('none', 'basic', 'request', 'request_response')`,
    ),
    statusCheck: check(
      "api_permissions_status_check",
      sql`${table.status} IN ('enabled', 'disabled')`,
    ),
  }),
);

export const menuApiBindings = pgTable(
  "menu_api_bindings",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id"),
    menuId: integer("menu_id").notNull(),
    apiPermissionId: integer("api_permission_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    bindingUnique: uniqueIndex("menu_api_bindings_unique").on(table.menuId, table.apiPermissionId),
  }),
);

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id"),
    userId: integer("user_id").notNull(),
    refreshTokenHash: text("refresh_token_hash").notNull(),
    currentOrganizationId: integer("current_organization_id").notNull(),
    tokenVersion: integer("token_version").notNull(),
    status: text("status").notNull().default("active"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    userActiveIndex: index("auth_sessions_user_active_idx").on(
      table.userId,
      table.revokedAt,
      table.expiresAt,
    ),
    statusCheck: check(
      "auth_sessions_status_check",
      sql`${table.status} IN ('active', 'revoked', 'expired')`,
    ),
  }),
);

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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    tokenHashUnique: uniqueIndex("refresh_tokens_hash_unique").on(table.tokenHash),
  }),
);

export const systemInitializationState = pgTable(
  "system_initialization_state",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id"),
    status: text("status").notNull(),
    initializedAt: timestamp("initialized_at", { withTimezone: true }),
    initializedBy: integer("initialized_by"),
    version: text("version").notNull(),
    ...timestamps,
  },
  (table) => ({
    statusCheck: check(
      "system_initialization_state_status_check",
      sql`${table.status} IN ('uninitialized', 'initialized')`,
    ),
  }),
);

export const systemConfigs = pgTable(
  "system_configs",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id"),
    configKey: text("config_key").notNull(),
    configValue: jsonb("config_value").notNull(),
    valueType: text("value_type").notNull(),
    groupKey: text("group_key").notNull(),
    description: text("description"),
    editable: boolean("editable").notNull().default(true),
    status: text("status").notNull().default("enabled"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    keyUnique: uniqueIndex("system_configs_key_unique").on(table.configKey),
    groupIndex: index("system_configs_group_idx").on(table.groupKey),
    valueTypeCheck: check(
      "system_configs_value_type_check",
      sql`${table.valueType} IN ('string', 'number', 'boolean', 'json')`,
    ),
    statusCheck: check(
      "system_configs_status_check",
      sql`${table.status} IN ('enabled', 'disabled')`,
    ),
  }),
);

export const dictionaryTypes = pgTable(
  "dictionary_types",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id"),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").notNull().default("enabled"),
  },
  (table) => ({
    codeUnique: uniqueIndex("dictionary_types_code_unique").on(table.code),
    statusCheck: check(
      "dictionary_types_status_check",
      sql`${table.status} IN ('enabled', 'disabled')`,
    ),
  }),
);

export const dictionaryItems = pgTable(
  "dictionary_items",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id"),
    typeId: integer("type_id").notNull(),
    itemValue: text("item_value").notNull(),
    labelI18nKey: text("label_i18n_key").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    status: text("status").notNull().default("enabled"),
  },
  (table) => ({
    typeValueUnique: uniqueIndex("dictionary_items_type_value_unique").on(
      table.typeId,
      table.itemValue,
    ),
    typeIndex: index("dictionary_items_type_idx").on(table.typeId),
    statusCheck: check(
      "dictionary_items_status_check",
      sql`${table.status} IN ('enabled', 'disabled')`,
    ),
  }),
);

export const i18nMessages = pgTable(
  "i18n_messages",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id"),
    messageKey: text("message_key").notNull(),
    language: text("language").notNull(),
    messageValue: text("message_value").notNull(),
    module: text("module").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    keyLanguageUnique: uniqueIndex("i18n_messages_key_language_unique").on(
      table.messageKey,
      table.language,
    ),
    moduleIndex: index("i18n_messages_module_idx").on(table.module),
  }),
);

export const cacheEntries = pgTable(
  "cache_entries",
  {
    id: serial("id").primaryKey(),
    key: text("key").notNull(),
    valueJson: jsonb("value_json").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    keyUnique: uniqueIndex("cache_entries_key_unique").on(table.key),
    expiresAtIndex: index("cache_entries_expires_at_idx").on(table.expiresAt),
  }),
);

export const rateLimitCounters = pgTable(
  "rate_limit_counters",
  {
    id: serial("id").primaryKey(),
    key: text("key").notNull(),
    windowStartsAt: timestamp("window_starts_at", { withTimezone: true }).notNull(),
    windowSeconds: integer("window_seconds").notNull(),
    count: integer("count").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => ({
    keyWindowUnique: uniqueIndex("rate_limit_counters_key_window_unique").on(
      table.key,
      table.windowStartsAt,
    ),
    expiresAtIndex: index("rate_limit_counters_expires_at_idx").on(table.expiresAt),
  }),
);

export const locks = pgTable(
  "locks",
  {
    id: serial("id").primaryKey(),
    key: text("key").notNull(),
    owner: text("owner").notNull(),
    fencingToken: integer("fencing_token").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    heartbeatAt: timestamp("heartbeat_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => ({
    keyUnique: uniqueIndex("locks_key_unique").on(table.key),
    expiresAtIndex: index("locks_expires_at_idx").on(table.expiresAt),
  }),
);

export const queueJobs = pgTable(
  "queue_jobs",
  {
    id: serial("id").primaryKey(),
    type: text("type").notNull(),
    payloadJson: jsonb("payload_json").notNull(),
    status: text("status").notNull().default("pending"),
    attempt: integer("attempt").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(1),
    availableAt: timestamp("available_at", { withTimezone: true }).notNull(),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    lockedBy: text("locked_by"),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lastError: text("last_error"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    statusAvailableIndex: index("queue_jobs_status_available_idx").on(
      table.status,
      table.availableAt,
    ),
    statusCheck: check(
      "queue_jobs_status_check",
      sql`${table.status} IN ('pending', 'running', 'succeeded', 'failed', 'dead_letter')`,
    ),
  }),
);

export const eventOutbox = pgTable(
  "event_outbox",
  {
    id: serial("id").primaryKey(),
    eventType: text("event_type").notNull(),
    payloadJson: jsonb("payload_json").notNull(),
    status: text("status").notNull().default("pending"),
    attempt: integer("attempt").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(1),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    lastError: text("last_error"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    statusNextRunIndex: index("event_outbox_status_next_run_idx").on(table.status, table.nextRunAt),
    statusCheck: check(
      "event_outbox_status_check",
      sql`${table.status} IN ('pending', 'published', 'failed', 'dead_letter')`,
    ),
  }),
);

export const scheduledJobs = pgTable(
  "scheduled_jobs",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull(),
    cronExpression: text("cron_expression").notNull(),
    handlerType: text("handler_type").notNull(),
    payloadJson: jsonb("payload_json").notNull(),
    status: text("status").notNull().default("enabled"),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    attempt: integer("attempt").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(1),
    lastError: text("last_error"),
    ...timestamps,
  },
  (table) => ({
    codeUnique: uniqueIndex("scheduled_jobs_code_unique").on(table.code),
    nextRunIndex: index("scheduled_jobs_next_run_idx").on(table.status, table.nextRunAt),
    statusCheck: check(
      "scheduled_jobs_status_check",
      sql`${table.status} IN ('enabled', 'disabled')`,
    ),
  }),
);

export const fileObjects = pgTable(
  "file_objects",
  {
    id: serial("id").primaryKey(),
    objectKey: text("object_key").notNull(),
    originalName: text("original_name").notNull(),
    contentType: text("content_type").notNull(),
    extension: text("extension").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storageDriver: text("storage_driver").notNull(),
    storageBucket: text("storage_bucket"),
    contentDeletedAt: timestamp("content_deleted_at", { withTimezone: true }),
    status: text("status").notNull().default("active"),
    referenced: boolean("referenced").notNull().default(false),
    ...softDelete,
    ...timestamps,
    createdBy: integer("created_by"),
    updatedBy: integer("updated_by"),
  },
  (table) => ({
    objectKeyUnique: uniqueIndex("file_objects_object_key_unique").on(table.objectKey),
    contentCleanupIndex: index("file_objects_content_cleanup_idx").on(
      table.status,
      table.isDeleted,
      table.contentDeletedAt,
    ),
    statusCheck: check("file_objects_status_check", sql`${table.status} IN ('active', 'invalid')`),
  }),
);

export const fileReferences = pgTable(
  "file_references",
  {
    id: serial("id").primaryKey(),
    fileObjectId: integer("file_object_id").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    referenceType: text("reference_type").notNull(),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    createdBy: integer("created_by"),
  },
  (table) => ({
    fileIndex: index("file_references_file_idx").on(table.fileObjectId, table.status),
    resourceIndex: index("file_references_resource_idx").on(table.resourceType, table.resourceId),
    statusCheck: check(
      "file_references_status_check",
      sql`${table.status} IN ('active', 'invalid')`,
    ),
  }),
);

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id"),
    channel: text("channel").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    status: text("status").notNull().default("unread"),
    metadataJson: jsonb("metadata_json").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...softDelete,
    ...timestamps,
  },
  (table) => ({
    userStatusIndex: index("notifications_user_status_idx").on(table.userId, table.status),
    channelCheck: check(
      "notifications_channel_check",
      sql`${table.channel} IN ('in_app', 'email', 'webhook', 'sms')`,
    ),
    statusCheck: check(
      "notifications_status_check",
      sql`${table.status} IN ('unread', 'read', 'archived', 'deleted')`,
    ),
  }),
);

export const notificationTemplates = pgTable(
  "notification_templates",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull(),
    channel: text("channel").notNull(),
    locale: text("locale").notNull(),
    subject: text("subject"),
    body: text("body").notNull(),
    variablesJson: jsonb("variables_json").notNull(),
    status: text("status").notNull().default("enabled"),
    ...timestamps,
  },
  (table) => ({
    codeLocaleUnique: uniqueIndex("notification_templates_code_locale_unique").on(
      table.code,
      table.locale,
    ),
    channelCheck: check(
      "notification_templates_channel_check",
      sql`${table.channel} IN ('in_app', 'email', 'sms')`,
    ),
    statusCheck: check(
      "notification_templates_status_check",
      sql`${table.status} IN ('enabled', 'disabled')`,
    ),
  }),
);

export const announcements = pgTable(
  "announcements",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id"),
    title: text("title").notNull(),
    content: text("content").notNull(),
    scopeType: text("scope_type").notNull(),
    status: text("status").notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ...softDelete,
    ...timestamps,
    createdBy: integer("created_by"),
    updatedBy: integer("updated_by"),
  },
  (table) => ({
    statusIndex: index("announcements_status_idx").on(table.status, table.publishedAt),
    scopeTypeCheck: check(
      "announcements_scope_type_check",
      sql`${table.scopeType} IN ('system', 'organization')`,
    ),
    statusCheck: check(
      "announcements_status_check",
      sql`${table.status} IN ('draft', 'published', 'deleted')`,
    ),
  }),
);

export const webhookSubscriptions = pgTable(
  "webhook_subscriptions",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id"),
    name: text("name").notNull(),
    url: text("url").notNull(),
    eventTypes: jsonb("event_types").notNull(),
    secret: text("secret"),
    status: text("status").notNull().default("enabled"),
    ...softDelete,
    ...timestamps,
    createdBy: integer("created_by"),
    updatedBy: integer("updated_by"),
  },
  (table) => ({
    statusIndex: index("webhook_subscriptions_status_idx").on(table.status),
    statusCheck: check(
      "webhook_subscriptions_status_check",
      sql`${table.status} IN ('enabled', 'disabled')`,
    ),
  }),
);

export const logEntries = pgTable(
  "log_entries",
  {
    id: serial("id").primaryKey(),
    logType: text("log_type").notNull(),
    level: text("level").notNull(),
    message: text("message").notNull(),
    traceId: text("trace_id"),
    userId: integer("user_id"),
    ipAddress: text("ip_address"),
    metadataJson: jsonb("metadata_json").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    typeOccurredIndex: index("log_entries_type_occurred_idx").on(table.logType, table.occurredAt),
    typeCheck: check(
      "log_entries_type_check",
      sql`${table.logType} IN ('login', 'operation', 'access', 'api_call', 'exception', 'security', 'scheduler', 'file_operation')`,
    ),
    levelCheck: check(
      "log_entries_level_check",
      sql`${table.level} IN ('debug', 'info', 'warn', 'error')`,
    ),
  }),
);

export const importExportTasks = pgTable(
  "import_export_tasks",
  {
    id: serial("id").primaryKey(),
    taskType: text("task_type").notNull(),
    resourceType: text("resource_type").notNull(),
    status: text("status").notNull().default("pending"),
    fileObjectId: integer("file_object_id"),
    resultFileObjectId: integer("result_file_object_id"),
    errorFileObjectId: integer("error_file_object_id"),
    totalRows: integer("total_rows").notNull().default(0),
    successRows: integer("success_rows").notNull().default(0),
    failedRows: integer("failed_rows").notNull().default(0),
    errorPreviewJson: jsonb("error_preview_json").notNull(),
    resultExpiresAt: timestamp("result_expires_at", { withTimezone: true }),
    ...timestamps,
    createdBy: integer("created_by"),
  },
  (table) => ({
    statusIndex: index("import_export_tasks_status_idx").on(table.status),
    typeCheck: check(
      "import_export_tasks_type_check",
      sql`${table.taskType} IN ('import', 'export')`,
    ),
    statusCheck: check(
      "import_export_tasks_status_check",
      sql`${table.status} IN ('pending', 'running', 'succeeded', 'failed')`,
    ),
  }),
);

export const postgresqlSchema = {
  announcements,
  apiPermissions,
  authSessions,
  cacheEntries,
  dictionaryItems,
  dictionaryTypes,
  eventOutbox,
  fileObjects,
  fileReferences,
  i18nMessages,
  importExportTasks,
  locks,
  logEntries,
  menuApiBindings,
  menus,
  notificationTemplates,
  notifications,
  organizations,
  permissions,
  queueJobs,
  rateLimitCounters,
  refreshTokens,
  fieldPermissionRules,
  rolePermissions,
  roleDataPermissions,
  roles,
  routeMetadata,
  scheduledJobs,
  schemaMetadata,
  systemConfigs,
  systemInitializationState,
  userPermissionOverrides,
  userPreferences,
  userOrganizationRoles,
  webhookSubscriptions,
  users,
};
