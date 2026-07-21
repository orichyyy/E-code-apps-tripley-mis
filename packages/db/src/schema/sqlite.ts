import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
};

const softDelete = {
  isDeleted: integer("is_deleted", { mode: "boolean" }).notNull().default(false),
  deletedAt: text("deleted_at"),
  deletedBy: integer("deleted_by"),
};

export const schemaMetadata = sqliteTable("schema_metadata", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  value: text("value", { mode: "json" }),
  ...timestamps,
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
    status: text("status", { enum: ["enabled", "disabled"] })
      .notNull()
      .default("enabled"),
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
    status: text("status", { enum: ["enabled", "disabled", "locked"] })
      .notNull()
      .default("enabled"),
    firstLoginPasswordChangeRequired: integer("first_login_password_change_required", {
      mode: "boolean",
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

export const userPreferences = sqliteTable(
  "user_preferences",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id"),
    userId: integer("user_id").notNull(),
    language: text("language", { enum: ["en", "zh"] })
      .notNull()
      .default("en"),
    themeMode: text("theme_mode", { enum: ["light", "dark"] })
      .notNull()
      .default("light"),
    themeColor: text("theme_color", { enum: ["blue", "emerald", "violet", "slate"] })
      .notNull()
      .default("blue"),
    pageTabsEnabled: integer("page_tabs_enabled", { mode: "boolean" }).notNull().default(true),
    updatedAt: text("updated_at").notNull(),
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
    status: text("status", { enum: ["enabled", "disabled"] })
      .notNull()
      .default("enabled"),
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

export const userOrganizationRoles = sqliteTable(
  "user_organization_roles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id"),
    userId: integer("user_id").notNull(),
    organizationId: integer("organization_id").notNull(),
    roleId: integer("role_id").notNull(),
    isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
    status: text("status", { enum: ["enabled", "disabled"] })
      .notNull()
      .default("enabled"),
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

export const permissions = sqliteTable(
  "permissions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id"),
    code: text("code").notNull(),
    name: text("name").notNull(),
    permissionType: text("permission_type", {
      enum: ["menu", "page", "action", "api", "data", "field"],
    }).notNull(),
    resource: text("resource").notNull(),
    action: text("action").notNull(),
    description: text("description"),
    module: text("module").notNull(),
    source: text("source").notNull().default("base_manifest"),
    manifestHash: text("manifest_hash").notNull(),
    status: text("status", { enum: ["enabled", "disabled"] })
      .notNull()
      .default("enabled"),
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

export const rolePermissions = sqliteTable(
  "role_permissions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id"),
    roleId: integer("role_id").notNull(),
    permissionId: integer("permission_id").notNull(),
    effect: text("effect", { enum: ["allow", "deny"] })
      .notNull()
      .default("allow"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    rolePermissionUnique: uniqueIndex("role_permissions_role_permission_unique").on(
      table.roleId,
      table.permissionId,
    ),
    effectCheck: check("role_permissions_effect_check", sql`${table.effect} IN ('allow', 'deny')`),
  }),
);

export const roleDataPermissions = sqliteTable(
  "role_data_permissions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id"),
    roleId: integer("role_id").notNull(),
    permissionId: integer("permission_id").notNull(),
    effect: text("effect", { enum: ["allow", "deny"] })
      .notNull()
      .default("allow"),
    ruleJson: text("rule_json", { mode: "json" }).notNull(),
    ...softDelete,
    ...timestamps,
    createdBy: integer("created_by"),
    updatedBy: integer("updated_by"),
  },
  (table) => ({
    effectCheck: check(
      "role_data_permissions_effect_check",
      sql`${table.effect} IN ('allow', 'deny')`,
    ),
  }),
);

export const fieldPermissionRules = sqliteTable(
  "field_permission_rules",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id"),
    targetType: text("target_type", { enum: ["role"] }).notNull(),
    targetId: integer("target_id").notNull(),
    resource: text("resource").notNull(),
    field: text("field").notNull(),
    scenario: text("scenario", { enum: ["list", "detail", "create", "edit"] }).notNull(),
    effect: text("effect", { enum: ["visible", "hidden", "readonly"] }).notNull(),
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
      table.scenario,
    ),
    targetTypeCheck: check(
      "field_permission_rules_target_type_check",
      sql`${table.targetType} IN ('role')`,
    ),
    effectCheck: check(
      "field_permission_rules_effect_check",
      sql`${table.effect} IN ('visible', 'hidden', 'readonly')`,
    ),
    scenarioCheck: check(
      "field_permission_rules_scenario_check",
      sql`${table.scenario} IN ('list', 'detail', 'create', 'edit')`,
    ),
  }),
);

export const userPermissionOverrides = sqliteTable(
  "user_permission_overrides",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id"),
    userId: integer("user_id").notNull(),
    permissionId: integer("permission_id").notNull(),
    effect: text("effect", { enum: ["allow", "deny"] }).notNull(),
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

export const menus = sqliteTable(
  "menus",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id"),
    parentMenuId: integer("parent_menu_id"),
    permissionCode: text("permission_code"),
    code: text("code").notNull(),
    routeCode: text("route_code"),
    titleI18nKey: text("title_i18n_key").notNull(),
    path: text("path").notNull(),
    icon: text("icon"),
    sortOrder: integer("sort_order").notNull().default(0),
    visible: integer("visible", { mode: "boolean" }).notNull().default(true),
    status: text("status", { enum: ["enabled", "disabled"] })
      .notNull()
      .default("enabled"),
    source: text("source").notNull().default("manual"),
    ownerModule: text("owner_module"),
    ...softDelete,
    ...timestamps,
  },
  (table) => ({
    codeUnique: uniqueIndex("menus_code_unique").on(table.code),
    pathUnique: uniqueIndex("menus_path_unique").on(table.path),
    statusCheck: check("menus_status_check", sql`${table.status} IN ('enabled', 'disabled')`),
  }),
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
    metadataJson: text("metadata_json", { mode: "json" }).notNull(),
    manifestHash: text("manifest_hash").notNull(),
    menuVisible: integer("menu_visible", { mode: "boolean" }).notNull().default(true),
    icon: text("icon"),
    sortOrder: integer("sort_order").notNull().default(0),
    status: text("status", { enum: ["enabled", "disabled"] })
      .notNull()
      .default("enabled"),
    source: text("source").notNull().default("base_manifest"),
    ownerModule: text("owner_module"),
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
    source: text("source").notNull().default("base_manifest"),
    manifestHash: text("manifest_hash"),
    status: text("status", { enum: ["enabled", "disabled"] })
      .notNull()
      .default("enabled"),
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

export const menuApiBindings = sqliteTable(
  "menu_api_bindings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id"),
    menuId: integer("menu_id").notNull(),
    apiPermissionId: integer("api_permission_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    bindingUnique: uniqueIndex("menu_api_bindings_unique").on(table.menuId, table.apiPermissionId),
  }),
);

export const authSessions = sqliteTable(
  "auth_sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id"),
    userId: integer("user_id").notNull(),
    refreshTokenHash: text("refresh_token_hash").notNull(),
    currentOrganizationId: integer("current_organization_id").notNull(),
    tokenVersion: integer("token_version").notNull(),
    status: text("status", { enum: ["active", "revoked", "expired"] })
      .notNull()
      .default("active"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    expiresAt: text("expires_at").notNull(),
    revokedAt: text("revoked_at"),
    createdAt: text("created_at").notNull(),
    lastSeenAt: text("last_seen_at").notNull(),
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
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    tokenHashUnique: uniqueIndex("refresh_tokens_hash_unique").on(table.tokenHash),
  }),
);

export const systemInitializationState = sqliteTable(
  "system_initialization_state",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id"),
    status: text("status", { enum: ["uninitialized", "initialized"] }).notNull(),
    initializedAt: text("initialized_at"),
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

export const systemConfigs = sqliteTable(
  "system_configs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id"),
    configKey: text("config_key").notNull(),
    configValue: text("config_value", { mode: "json" }).notNull(),
    valueType: text("value_type", { enum: ["string", "number", "boolean", "json"] }).notNull(),
    groupKey: text("group_key").notNull(),
    description: text("description"),
    editable: integer("editable", { mode: "boolean" }).notNull().default(true),
    status: text("status", { enum: ["enabled", "disabled"] })
      .notNull()
      .default("enabled"),
    updatedAt: text("updated_at").notNull(),
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

export const dictionaryTypes = sqliteTable(
  "dictionary_types",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id"),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status", { enum: ["enabled", "disabled"] })
      .notNull()
      .default("enabled"),
  },
  (table) => ({
    codeUnique: uniqueIndex("dictionary_types_code_unique").on(table.code),
    statusCheck: check(
      "dictionary_types_status_check",
      sql`${table.status} IN ('enabled', 'disabled')`,
    ),
  }),
);

export const dictionaryItems = sqliteTable(
  "dictionary_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id"),
    typeId: integer("type_id").notNull(),
    itemValue: text("item_value").notNull(),
    labelI18nKey: text("label_i18n_key").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    status: text("status", { enum: ["enabled", "disabled"] })
      .notNull()
      .default("enabled"),
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

export const i18nMessages = sqliteTable(
  "i18n_messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id"),
    messageKey: text("message_key").notNull(),
    language: text("language").notNull(),
    messageValue: text("message_value").notNull(),
    defaultMessage: text("default_message").notNull().default(""),
    overrideValue: text("override_value"),
    module: text("module").notNull(),
    status: text("status", { enum: ["enabled", "disabled"] })
      .notNull()
      .default("enabled"),
    manifestHash: text("manifest_hash"),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    keyLanguageUnique: uniqueIndex("i18n_messages_key_language_unique").on(
      table.messageKey,
      table.language,
    ),
    moduleIndex: index("i18n_messages_module_idx").on(table.module),
  }),
);

export const businessModuleRegistryState = sqliteTable(
  "business_module_registry_state",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    singletonKey: text("singleton_key").notNull().default("current"),
    registryHash: text("registry_hash").notNull(),
    acceptedAt: text("accepted_at").notNull(),
    acceptedBy: integer("accepted_by"),
    ...timestamps,
  },
  (table) => ({
    singletonUnique: uniqueIndex("business_module_registry_state_singleton_unique").on(
      table.singletonKey,
    ),
  }),
);

export const businessModuleRegistryEntries = sqliteTable(
  "business_module_registry_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    moduleCode: text("module_code").notNull(),
    definitionJson: text("definition_json", { mode: "json" }).notNull(),
    definitionHash: text("definition_hash").notNull(),
    activationHash: text("activation_hash").notNull(),
    status: text("status", { enum: ["active", "disabled"] })
      .notNull()
      .default("active"),
    acceptedAt: text("accepted_at").notNull(),
    acceptedBy: integer("accepted_by"),
    disabledAt: text("disabled_at"),
    ...timestamps,
  },
  (table) => ({
    codeUnique: uniqueIndex("business_module_registry_entries_code_unique").on(table.moduleCode),
    statusCheck: check(
      "business_module_registry_entries_status_check",
      sql`${table.status} IN ('active', 'disabled')`,
    ),
  }),
);

export const cacheEntries = sqliteTable(
  "cache_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    key: text("key").notNull(),
    valueJson: text("value_json", { mode: "json" }).notNull(),
    expiresAt: text("expires_at"),
    ...timestamps,
  },
  (table) => ({
    keyUnique: uniqueIndex("cache_entries_key_unique").on(table.key),
    expiresAtIndex: index("cache_entries_expires_at_idx").on(table.expiresAt),
  }),
);

export const rateLimitCounters = sqliteTable(
  "rate_limit_counters",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    key: text("key").notNull(),
    windowStartsAt: text("window_starts_at").notNull(),
    windowSeconds: integer("window_seconds").notNull(),
    count: integer("count").notNull(),
    expiresAt: text("expires_at").notNull(),
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

export const locks = sqliteTable(
  "locks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    key: text("key").notNull(),
    owner: text("owner").notNull(),
    fencingToken: integer("fencing_token").notNull(),
    expiresAt: text("expires_at").notNull(),
    heartbeatAt: text("heartbeat_at").notNull(),
    ...timestamps,
  },
  (table) => ({
    keyUnique: uniqueIndex("locks_key_unique").on(table.key),
    expiresAtIndex: index("locks_expires_at_idx").on(table.expiresAt),
  }),
);

export const queueJobs = sqliteTable(
  "queue_jobs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    type: text("type").notNull(),
    payloadJson: text("payload_json", { mode: "json" }).notNull(),
    status: text("status", { enum: ["pending", "running", "succeeded", "failed", "dead_letter"] })
      .notNull()
      .default("pending"),
    attempt: integer("attempt").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(1),
    availableAt: text("available_at").notNull(),
    nextRunAt: text("next_run_at"),
    lockedBy: text("locked_by"),
    lockedAt: text("locked_at"),
    lastError: text("last_error"),
    completedAt: text("completed_at"),
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

export const eventOutbox = sqliteTable(
  "event_outbox",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    eventKey: text("event_key"),
    eventType: text("event_type").notNull(),
    payloadJson: text("payload_json", { mode: "json" }).notNull(),
    status: text("status", { enum: ["pending", "published", "failed", "dead_letter"] })
      .notNull()
      .default("pending"),
    attempt: integer("attempt").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(1),
    nextRunAt: text("next_run_at"),
    lastError: text("last_error"),
    occurredAt: text("occurred_at").notNull(),
    processedAt: text("processed_at"),
    ...timestamps,
  },
  (table) => ({
    eventKeyUnique: uniqueIndex("event_outbox_event_key_unique").on(table.eventKey),
    statusNextRunIndex: index("event_outbox_status_next_run_idx").on(table.status, table.nextRunAt),
    statusCheck: check(
      "event_outbox_status_check",
      sql`${table.status} IN ('pending', 'published', 'failed', 'dead_letter')`,
    ),
  }),
);

export const scheduledJobs = sqliteTable(
  "scheduled_jobs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code").notNull(),
    cronExpression: text("cron_expression").notNull(),
    handlerType: text("handler_type").notNull(),
    payloadJson: text("payload_json", { mode: "json" }).notNull(),
    status: text("status", { enum: ["enabled", "disabled"] })
      .notNull()
      .default("enabled"),
    lastRunAt: text("last_run_at"),
    nextRunAt: text("next_run_at"),
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

export const fileObjects = sqliteTable(
  "file_objects",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    objectKey: text("object_key").notNull(),
    originalName: text("original_name").notNull(),
    contentType: text("content_type").notNull(),
    extension: text("extension").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storageDriver: text("storage_driver").notNull(),
    storageBucket: text("storage_bucket"),
    contentDeletedAt: text("content_deleted_at"),
    status: text("status", { enum: ["active", "invalid"] })
      .notNull()
      .default("active"),
    referenced: integer("referenced", { mode: "boolean" }).notNull().default(false),
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

export const fileReferences = sqliteTable(
  "file_references",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    fileObjectId: integer("file_object_id").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    referenceType: text("reference_type").notNull(),
    status: text("status", { enum: ["active", "invalid"] })
      .notNull()
      .default("active"),
    createdAt: text("created_at").notNull(),
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

export const notifications = sqliteTable(
  "notifications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id"),
    channel: text("channel", { enum: ["in_app", "email", "webhook", "sms"] }).notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    requestKey: text("request_key"),
    status: text("status", { enum: ["unread", "read", "archived", "deleted"] })
      .notNull()
      .default("unread"),
    metadataJson: text("metadata_json", { mode: "json" }).notNull(),
    readAt: text("read_at"),
    archivedAt: text("archived_at"),
    ...softDelete,
    ...timestamps,
  },
  (table) => ({
    userStatusIndex: index("notifications_user_status_idx").on(table.userId, table.status),
    userRequestKeyUnique: uniqueIndex("notifications_user_request_key_unique").on(
      table.userId,
      table.requestKey,
    ),
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

export const notificationTemplates = sqliteTable(
  "notification_templates",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code").notNull(),
    channel: text("channel", { enum: ["in_app", "email", "sms"] }).notNull(),
    locale: text("locale").notNull(),
    subject: text("subject"),
    body: text("body").notNull(),
    variablesJson: text("variables_json", { mode: "json" }).notNull(),
    status: text("status", { enum: ["enabled", "disabled"] })
      .notNull()
      .default("enabled"),
    ...timestamps,
  },
  (table) => ({
    codeLocaleUnique: uniqueIndex("notification_templates_channel_code_locale_unique").on(
      table.channel,
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

export const emailDeliveries = sqliteTable(
  "email_deliveries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    requestKey: text("request_key").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    userId: integer("user_id").notNull(),
    templateId: integer("template_id").notNull(),
    templateCode: text("template_code").notNull(),
    locale: text("locale").notNull(),
    templateUpdatedAt: text("template_updated_at").notNull(),
    maskedRecipient: text("masked_recipient").notNull(),
    messageId: text("message_id").notNull(),
    contentKeyId: text("content_key_id"),
    contentEnvelope: text("content_envelope"),
    referenceType: text("reference_type"),
    referenceId: text("reference_id"),
    status: text("status", {
      enum: ["pending", "running", "succeeded", "failed", "canceled"],
    })
      .notNull()
      .default("pending"),
    attempt: integer("attempt").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull(),
    nextAttemptAt: text("next_attempt_at").notNull(),
    lockedBy: text("locked_by"),
    lockedAt: text("locked_at"),
    lastSmtpCode: integer("last_smtp_code"),
    lastErrorCode: text("last_error_code"),
    lastErrorMessage: text("last_error_message"),
    succeededAt: text("succeeded_at"),
    failedAt: text("failed_at"),
    canceledAt: text("canceled_at"),
    contentPurgedAt: text("content_purged_at"),
    ...timestamps,
  },
  (table) => ({
    requestUserUnique: uniqueIndex("email_deliveries_request_user_unique").on(
      table.requestKey,
      table.userId,
    ),
    claimIndex: index("email_deliveries_claim_idx").on(table.status, table.nextAttemptAt),
    userIndex: index("email_deliveries_user_idx").on(table.userId, table.createdAt),
    templateIndex: index("email_deliveries_template_idx").on(
      table.templateCode,
      table.locale,
      table.createdAt,
    ),
    statusCheck: check(
      "email_deliveries_status_check",
      sql`${table.status} IN ('pending', 'running', 'succeeded', 'failed', 'canceled')`,
    ),
  }),
);

export const emailDeliveryAttempts = sqliteTable(
  "email_delivery_attempts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    deliveryId: integer("delivery_id").notNull(),
    attemptNumber: integer("attempt_number").notNull(),
    status: text("status", { enum: ["succeeded", "failed"] }).notNull(),
    startedAt: text("started_at").notNull(),
    finishedAt: text("finished_at").notNull(),
    durationMs: integer("duration_ms").notNull(),
    smtpCode: integer("smtp_code"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    deliveryAttemptUnique: uniqueIndex("email_delivery_attempts_delivery_number_unique").on(
      table.deliveryId,
      table.attemptNumber,
    ),
    deliveryIndex: index("email_delivery_attempts_delivery_idx").on(table.deliveryId),
    statusCheck: check(
      "email_delivery_attempts_status_check",
      sql`${table.status} IN ('succeeded', 'failed')`,
    ),
  }),
);

export const announcements = sqliteTable(
  "announcements",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id"),
    title: text("title").notNull(),
    content: text("content").notNull(),
    scopeType: text("scope_type", { enum: ["system", "organization"] }).notNull(),
    status: text("status", { enum: ["draft", "published", "deleted"] })
      .notNull()
      .default("draft"),
    publishedAt: text("published_at"),
    expiresAt: text("expire_at"),
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

export const announcementTargets = sqliteTable(
  "announcement_targets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    announcementId: integer("announcement_id").notNull(),
    targetType: text("target_type", { enum: ["organization"] }).notNull(),
    targetId: integer("target_id").notNull(),
  },
  (table) => ({
    announcementTargetUnique: uniqueIndex("announcement_targets_binding_unique").on(
      table.announcementId,
      table.targetType,
      table.targetId,
    ),
    announcementIndex: index("announcement_targets_announcement_idx").on(table.announcementId),
    targetIndex: index("announcement_targets_target_idx").on(table.targetType, table.targetId),
    targetTypeCheck: check(
      "announcement_targets_target_type_check",
      sql`${table.targetType} = 'organization'`,
    ),
  }),
);

export const webhookSubscriptions = sqliteTable(
  "webhook_subscriptions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id"),
    name: text("name").notNull(),
    url: text("url").notNull(),
    eventTypes: text("event_types", { mode: "json" }).notNull(),
    secret: text("secret"),
    revision: integer("revision").notNull().default(1),
    status: text("status", { enum: ["enabled", "disabled"] })
      .notNull()
      .default("enabled"),
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

export const webhookDeliveries = sqliteTable(
  "webhook_deliveries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    eventOutboxId: integer("event_outbox_id").notNull(),
    subscriptionId: integer("subscription_id").notNull(),
    subscriptionRevision: integer("subscription_revision").notNull(),
    eventType: text("event_type").notNull(),
    eventSource: text("event_source").notNull(),
    eventPayloadJson: text("event_payload_json", { mode: "json" }).notNull(),
    targetUrl: text("target_url").notNull(),
    status: text("status", {
      enum: ["pending", "running", "succeeded", "failed", "canceled"],
    })
      .notNull()
      .default("pending"),
    attempt: integer("attempt").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull(),
    nextAttemptAt: text("next_attempt_at").notNull(),
    lockedBy: text("locked_by"),
    lockedAt: text("locked_at"),
    lastHttpStatus: integer("last_http_status"),
    lastErrorCode: text("last_error_code"),
    lastErrorMessage: text("last_error_message"),
    succeededAt: text("succeeded_at"),
    failedAt: text("failed_at"),
    canceledAt: text("canceled_at"),
    ...timestamps,
  },
  (table) => ({
    eventSubscriptionUnique: uniqueIndex("webhook_deliveries_event_subscription_unique").on(
      table.eventOutboxId,
      table.subscriptionId,
    ),
    claimIndex: index("webhook_deliveries_claim_idx").on(table.status, table.nextAttemptAt),
    subscriptionIndex: index("webhook_deliveries_subscription_idx").on(
      table.subscriptionId,
      table.createdAt,
    ),
    statusCheck: check(
      "webhook_deliveries_status_check",
      sql`${table.status} IN ('pending', 'running', 'succeeded', 'failed', 'canceled')`,
    ),
  }),
);

export const webhookDeliveryAttempts = sqliteTable(
  "webhook_delivery_attempts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    deliveryId: integer("delivery_id").notNull(),
    attemptNumber: integer("attempt_number").notNull(),
    status: text("status", { enum: ["succeeded", "failed"] }).notNull(),
    startedAt: text("started_at").notNull(),
    finishedAt: text("finished_at").notNull(),
    durationMs: integer("duration_ms").notNull(),
    httpStatus: integer("http_status"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    deliveryAttemptUnique: uniqueIndex("webhook_delivery_attempts_delivery_number_unique").on(
      table.deliveryId,
      table.attemptNumber,
    ),
    deliveryIndex: index("webhook_delivery_attempts_delivery_idx").on(table.deliveryId),
    statusCheck: check(
      "webhook_delivery_attempts_status_check",
      sql`${table.status} IN ('succeeded', 'failed')`,
    ),
  }),
);

export const logEntries = sqliteTable(
  "log_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    logType: text("log_type").notNull(),
    level: text("level", { enum: ["debug", "info", "warn", "error"] }).notNull(),
    message: text("message").notNull(),
    traceId: text("trace_id"),
    userId: integer("user_id"),
    ipAddress: text("ip_address"),
    metadataJson: text("metadata_json", { mode: "json" }).notNull(),
    occurredAt: text("occurred_at").notNull(),
    createdAt: text("created_at").notNull(),
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

export const importExportTasks = sqliteTable(
  "import_export_tasks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    idempotencyKey: text("idempotency_key"),
    taskType: text("task_type", { enum: ["import", "export"] }).notNull(),
    resourceType: text("resource_type").notNull(),
    status: text("status", { enum: ["pending", "running", "succeeded", "failed"] })
      .notNull()
      .default("pending"),
    fileObjectId: integer("file_object_id"),
    resultFileObjectId: integer("result_file_object_id"),
    errorFileObjectId: integer("error_file_object_id"),
    totalRows: integer("total_rows").notNull().default(0),
    successRows: integer("success_rows").notNull().default(0),
    failedRows: integer("failed_rows").notNull().default(0),
    errorPreviewJson: text("error_preview_json", { mode: "json" }).notNull(),
    requestJson: text("request_json", { mode: "json" }).notNull().default({}),
    executionContextJson: text("execution_context_json", { mode: "json" }),
    resultExpiresAt: text("result_expires_at"),
    ...timestamps,
    createdBy: integer("created_by"),
  },
  (table) => ({
    idempotencyUnique: uniqueIndex("import_export_tasks_idempotency_unique").on(
      table.taskType,
      table.resourceType,
      table.idempotencyKey,
    ),
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

export const sqliteSchema = {
  announcements,
  apiPermissions,
  authSessions,
  businessModuleRegistryEntries,
  businessModuleRegistryState,
  cacheEntries,
  dictionaryItems,
  dictionaryTypes,
  emailDeliveries,
  emailDeliveryAttempts,
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
  webhookDeliveries,
  webhookDeliveryAttempts,
  users,
};
