import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { postgresql, sqlite } from "../src";

type TableWithSymbols = Record<PropertyKey, unknown>;
type ExtraConfigItem = {
  config?: { name?: string };
  constructor: { name: string };
  name?: string;
};
type SharedSchemaTableName = Exclude<keyof typeof sqlite, "sqliteSchema"> &
  Exclude<keyof typeof postgresql, "postgresqlSchema">;

function getCheckNames(table: unknown): string[] {
  const tableRecord = table as TableWithSymbols;
  const symbols = Object.getOwnPropertySymbols(tableRecord);
  const builderSymbol = symbols.find(
    (symbol) => symbol.toString() === "Symbol(drizzle:ExtraConfigBuilder)",
  );
  const columnsSymbol = symbols.find(
    (symbol) => symbol.toString() === "Symbol(drizzle:ExtraConfigColumns)",
  );

  if (!builderSymbol || !columnsSymbol) {
    return [];
  }

  const buildExtraConfig = tableRecord[builderSymbol] as
    ((columns: unknown) => Record<string, ExtraConfigItem>) | undefined;

  if (!buildExtraConfig) {
    return [];
  }

  return Object.values(buildExtraConfig(tableRecord[columnsSymbol]))
    .filter((item) => item.constructor.name === "CheckBuilder")
    .map((item) => item.name)
    .filter((name): name is string => Boolean(name))
    .sort();
}

function getIndexNames(table: unknown): string[] {
  const tableRecord = table as TableWithSymbols;
  const symbols = Object.getOwnPropertySymbols(tableRecord);
  const builderSymbol = symbols.find(
    (symbol) => symbol.toString() === "Symbol(drizzle:ExtraConfigBuilder)",
  );
  const columnsSymbol = symbols.find(
    (symbol) => symbol.toString() === "Symbol(drizzle:ExtraConfigColumns)",
  );

  if (!builderSymbol || !columnsSymbol) {
    return [];
  }

  const buildExtraConfig = tableRecord[builderSymbol] as
    ((columns: unknown) => Record<string, ExtraConfigItem>) | undefined;

  if (!buildExtraConfig) {
    return [];
  }

  return Object.values(buildExtraConfig(tableRecord[columnsSymbol]))
    .filter((item): item is ExtraConfigItem & { config: { name?: string } } => {
      return item.constructor.name === "IndexBuilder" && Boolean(item.config);
    })
    .map((item) => item.config.name)
    .filter((name): name is string => Boolean(name))
    .sort();
}

describe("backend core schema", () => {
  it("keeps permission metadata columns aligned across SQLite and PostgreSQL", () => {
    expect(sqlite.permissions.module.name).toBe("module");
    expect(sqlite.permissions.resource.name).toBe("resource");
    expect(sqlite.permissions.action.name).toBe("action");
    expect(sqlite.permissions.source.name).toBe("source");
    expect(sqlite.permissions.manifestHash.name).toBe("manifest_hash");
    expect(postgresql.permissions.module.name).toBe("module");
    expect(postgresql.permissions.resource.name).toBe("resource");
    expect(postgresql.permissions.action.name).toBe("action");
    expect(postgresql.permissions.source.name).toBe("source");
    expect(postgresql.permissions.manifestHash.name).toBe("manifest_hash");
  });

  it("keeps role metadata and audit columns aligned across dialects", () => {
    expect(sqlite.roles.description.name).toBe("description");
    expect(sqlite.roles.dataScopeRuleId.name).toBe("data_scope_rule_id");
    expect(sqlite.roles.isBuiltin.name).toBe("is_builtin");
    expect(sqlite.roles.createdBy.name).toBe("created_by");
    expect(sqlite.roles.updatedBy.name).toBe("updated_by");
    expect(postgresql.roles.description.name).toBe("description");
    expect(postgresql.roles.dataScopeRuleId.name).toBe("data_scope_rule_id");
    expect(postgresql.roles.isBuiltin.name).toBe("is_builtin");
    expect(postgresql.roles.createdBy.name).toBe("created_by");
    expect(postgresql.roles.updatedBy.name).toBe("updated_by");
  });

  it("keeps role permission effect metadata aligned across dialects", () => {
    expect(sqlite.rolePermissions.effect.name).toBe("effect");
    expect(sqlite.rolePermissions.updatedAt.name).toBe("updated_at");
    expect(postgresql.rolePermissions.effect.name).toBe("effect");
    expect(postgresql.rolePermissions.updatedAt.name).toBe("updated_at");
  });

  it("keeps permission extension tables aligned across dialects", () => {
    expect(sqlite.roleDataPermissions.roleId.name).toBe("role_id");
    expect(sqlite.roleDataPermissions.permissionId.name).toBe("permission_id");
    expect(sqlite.fieldPermissionRules.targetType.name).toBe("target_type");
    expect(sqlite.fieldPermissionRules.targetId.name).toBe("target_id");
    expect(sqlite.userPermissionOverrides.userId.name).toBe("user_id");
    expect(sqlite.userPermissionOverrides.permissionId.name).toBe("permission_id");
    expect(postgresql.roleDataPermissions.roleId.name).toBe("role_id");
    expect(postgresql.roleDataPermissions.permissionId.name).toBe("permission_id");
    expect(postgresql.fieldPermissionRules.targetType.name).toBe("target_type");
    expect(postgresql.fieldPermissionRules.targetId.name).toBe("target_id");
    expect(postgresql.userPermissionOverrides.userId.name).toBe("user_id");
    expect(postgresql.userPermissionOverrides.permissionId.name).toBe("permission_id");
  });

  it("keeps user organization role binding soft-delete columns aligned across dialects", () => {
    expect(sqlite.userOrganizationRoles.isPrimary.name).toBe("is_primary");
    expect(sqlite.userOrganizationRoles.status.name).toBe("status");
    expect(sqlite.userOrganizationRoles.createdBy.name).toBe("created_by");
    expect(sqlite.userOrganizationRoles.updatedBy.name).toBe("updated_by");
    expect(sqlite.userOrganizationRoles.isDeleted.name).toBe("is_deleted");
    expect(sqlite.userOrganizationRoles.deletedAt.name).toBe("deleted_at");
    expect(sqlite.userOrganizationRoles.deletedBy.name).toBe("deleted_by");
    expect(postgresql.userOrganizationRoles.isPrimary.name).toBe("is_primary");
    expect(postgresql.userOrganizationRoles.status.name).toBe("status");
    expect(postgresql.userOrganizationRoles.createdBy.name).toBe("created_by");
    expect(postgresql.userOrganizationRoles.updatedBy.name).toBe("updated_by");
    expect(postgresql.userOrganizationRoles.isDeleted.name).toBe("is_deleted");
    expect(postgresql.userOrganizationRoles.deletedAt.name).toBe("deleted_at");
    expect(postgresql.userOrganizationRoles.deletedBy.name).toBe("deleted_by");
  });

  it("keeps user preference columns aligned across dialects", () => {
    expect(sqlite.userPreferences.userId.name).toBe("user_id");
    expect(sqlite.userPreferences.language.name).toBe("language");
    expect(sqlite.userPreferences.themeMode.name).toBe("theme_mode");
    expect(sqlite.userPreferences.themeColor.name).toBe("theme_color");
    expect(sqlite.userPreferences.pageTabsEnabled.name).toBe("page_tabs_enabled");
    expect(postgresql.userPreferences.userId.name).toBe("user_id");
    expect(postgresql.userPreferences.language.name).toBe("language");
    expect(postgresql.userPreferences.themeMode.name).toBe("theme_mode");
    expect(postgresql.userPreferences.themeColor.name).toBe("theme_color");
    expect(postgresql.userPreferences.pageTabsEnabled.name).toBe("page_tabs_enabled");
  });

  it("keeps API permission metadata columns aligned across SQLite and PostgreSQL", () => {
    expect(sqlite.apiPermissions.module.name).toBe("module");
    expect(sqlite.apiPermissions.requiredPermission.name).toBe("required_permission");
    expect(sqlite.apiPermissions.public.name).toBe("public");
    expect(postgresql.apiPermissions.module.name).toBe("module");
    expect(postgresql.apiPermissions.requiredPermission.name).toBe("required_permission");
    expect(postgresql.apiPermissions.public.name).toBe("public");
  });

  it("keeps menu visibility columns aligned across SQLite and PostgreSQL", () => {
    expect(sqlite.menus.visible.name).toBe("visible");
    expect(postgresql.menus.visible.name).toBe("visible");
  });

  it("keeps menu permission-code columns aligned across SQLite and PostgreSQL", () => {
    expect(sqlite.menus.permissionCode.name).toBe("permission_code");
    expect(postgresql.menus.permissionCode.name).toBe("permission_code");
  });

  it("keeps route manifest metadata columns aligned across SQLite and PostgreSQL", () => {
    expect(sqlite.routeMetadata.metadataJson.name).toBe("metadata_json");
    expect(sqlite.routeMetadata.manifestHash.name).toBe("manifest_hash");
    expect(postgresql.routeMetadata.metadataJson.name).toBe("metadata_json");
    expect(postgresql.routeMetadata.manifestHash.name).toBe("manifest_hash");
  });

  it("keeps login session token-version snapshot columns aligned across dialects", () => {
    expect(sqlite.authSessions.tokenVersion.name).toBe("token_version");
    expect(sqlite.authSessions.status.name).toBe("status");
    expect(postgresql.authSessions.tokenVersion.name).toBe("token_version");
    expect(postgresql.authSessions.status.name).toBe("status");
  });

  it("keeps infrastructure foundation tables aligned across dialects", () => {
    expect(sqlite.cacheEntries.key.name).toBe("key");
    expect(postgresql.cacheEntries.key.name).toBe("key");
    expect(sqlite.rateLimitCounters.windowStartsAt.name).toBe("window_starts_at");
    expect(postgresql.rateLimitCounters.windowStartsAt.name).toBe("window_starts_at");
    expect(sqlite.locks.fencingToken.name).toBe("fencing_token");
    expect(postgresql.locks.fencingToken.name).toBe("fencing_token");
    expect(sqlite.queueJobs.maxAttempts.name).toBe("max_attempts");
    expect(postgresql.queueJobs.maxAttempts.name).toBe("max_attempts");
    expect(sqlite.eventOutbox.eventType.name).toBe("event_type");
    expect(postgresql.eventOutbox.eventType.name).toBe("event_type");
    expect(sqlite.scheduledJobs.cronExpression.name).toBe("cron_expression");
    expect(postgresql.scheduledJobs.cronExpression.name).toBe("cron_expression");
    expect(sqlite.fileObjects.objectKey.name).toBe("object_key");
    expect(postgresql.fileObjects.objectKey.name).toBe("object_key");
    expect(sqlite.fileReferences.fileObjectId.name).toBe("file_object_id");
    expect(postgresql.fileReferences.fileObjectId.name).toBe("file_object_id");
    expect(sqlite.notifications.metadataJson.name).toBe("metadata_json");
    expect(postgresql.notifications.metadataJson.name).toBe("metadata_json");
    expect(sqlite.notificationTemplates.variablesJson.name).toBe("variables_json");
    expect(postgresql.notificationTemplates.variablesJson.name).toBe("variables_json");
    expect(sqlite.logEntries.logType.name).toBe("log_type");
    expect(postgresql.logEntries.logType.name).toBe("log_type");
    expect(sqlite.importExportTasks.resultExpiresAt.name).toBe("result_expires_at");
    expect(postgresql.importExportTasks.resultExpiresAt.name).toBe("result_expires_at");
  });

  it("keeps system configuration, dictionary, and i18n tables aligned across dialects", () => {
    expect(sqlite.systemConfigs.configKey.name).toBe("config_key");
    expect(postgresql.systemConfigs.configKey.name).toBe("config_key");
    expect(sqlite.systemConfigs.configValue.name).toBe("config_value");
    expect(postgresql.systemConfigs.configValue.name).toBe("config_value");
    expect(sqlite.dictionaryTypes.code.name).toBe("code");
    expect(postgresql.dictionaryTypes.code.name).toBe("code");
    expect(sqlite.dictionaryItems.labelI18nKey.name).toBe("label_i18n_key");
    expect(postgresql.dictionaryItems.labelI18nKey.name).toBe("label_i18n_key");
    expect(sqlite.i18nMessages.messageKey.name).toBe("message_key");
    expect(postgresql.i18nMessages.messageKey.name).toBe("message_key");
  });

  it("keeps announcement and webhook subscription tables aligned across dialects", () => {
    expect(sqlite.announcements.scopeType.name).toBe("scope_type");
    expect(postgresql.announcements.scopeType.name).toBe("scope_type");
    expect(sqlite.announcements.publishedAt.name).toBe("published_at");
    expect(postgresql.announcements.publishedAt.name).toBe("published_at");
    expect(sqlite.webhookSubscriptions.eventTypes.name).toBe("event_types");
    expect(postgresql.webhookSubscriptions.eventTypes.name).toBe("event_types");
    expect(sqlite.webhookSubscriptions.secret.name).toBe("secret");
    expect(postgresql.webhookSubscriptions.secret.name).toBe("secret");
  });

  it("keeps the root organization segment constraint in both migrations", () => {
    const sqliteMigration = readFileSync(
      new URL("../src/migrations/sqlite/0001_backend_core_foundation.sql", import.meta.url),
      "utf8",
    );
    const postgresqlMigration = readFileSync(
      new URL("../src/migrations/postgresql/0001_backend_core_foundation.sql", import.meta.url),
      "utf8",
    );

    expect(sqliteMigration).toContain("CHECK (level <> 1 OR segment BETWEEN 1 AND 127)");
    expect(postgresqlMigration).toContain("CHECK (level <> 1 OR segment BETWEEN 1 AND 127)");
  });

  it("keeps Drizzle check constraints aligned with backend core enum constraints", () => {
    const expectedChecksByTable = new Map<SharedSchemaTableName, string[]>([
      [
        "organizations",
        [
          "organizations_level_check",
          "organizations_root_segment_check",
          "organizations_segment_check",
          "organizations_status_check",
        ],
      ],
      ["users", ["users_status_check"]],
      [
        "userPreferences",
        [
          "user_preferences_language_check",
          "user_preferences_theme_color_check",
          "user_preferences_theme_mode_check",
        ],
      ],
      ["roles", ["roles_status_check"]],
      ["userOrganizationRoles", ["user_organization_roles_status_check"]],
      ["permissions", ["permissions_status_check", "permissions_type_check"]],
      ["rolePermissions", ["role_permissions_effect_check"]],
      ["roleDataPermissions", ["role_data_permissions_effect_check"]],
      [
        "fieldPermissionRules",
        ["field_permission_rules_effect_check", "field_permission_rules_target_type_check"],
      ],
      ["userPermissionOverrides", ["user_permission_overrides_effect_check"]],
      ["menus", ["menus_status_check"]],
      ["routeMetadata", ["route_metadata_status_check"]],
      ["apiPermissions", ["api_permissions_log_level_check", "api_permissions_status_check"]],
      ["authSessions", ["auth_sessions_status_check"]],
      ["systemInitializationState", ["system_initialization_state_status_check"]],
      ["queueJobs", ["queue_jobs_status_check"]],
      ["eventOutbox", ["event_outbox_status_check"]],
      ["scheduledJobs", ["scheduled_jobs_status_check"]],
      ["fileObjects", ["file_objects_status_check"]],
      ["fileReferences", ["file_references_status_check"]],
      ["notifications", ["notifications_channel_check", "notifications_status_check"]],
      [
        "notificationTemplates",
        ["notification_templates_channel_check", "notification_templates_status_check"],
      ],
      ["logEntries", ["log_entries_level_check", "log_entries_type_check"]],
      ["importExportTasks", ["import_export_tasks_status_check", "import_export_tasks_type_check"]],
      ["systemConfigs", ["system_configs_status_check", "system_configs_value_type_check"]],
      ["dictionaryTypes", ["dictionary_types_status_check"]],
      ["dictionaryItems", ["dictionary_items_status_check"]],
      ["announcements", ["announcements_scope_type_check", "announcements_status_check"]],
      ["webhookSubscriptions", ["webhook_subscriptions_status_check"]],
    ]);

    for (const [tableName, expectedChecks] of expectedChecksByTable) {
      expect(getCheckNames(sqlite[tableName])).toEqual(expectedChecks);
      expect(getCheckNames(postgresql[tableName])).toEqual(expectedChecks);
    }
  });

  it("keeps Drizzle indexes aligned with backend core migrations", () => {
    const expectedIndexesByTable = new Map<SharedSchemaTableName, string[]>([
      [
        "organizations",
        ["organizations_code_unique", "organizations_path_level_idx", "organizations_path_unique"],
      ],
      ["users", ["users_email_unique", "users_phone_unique", "users_username_unique"]],
      ["userPreferences", ["user_preferences_user_unique"]],
      ["roles", ["roles_code_unique"]],
      ["userOrganizationRoles", ["user_organization_roles_user_org_unique"]],
      ["permissions", ["permissions_code_unique"]],
      ["rolePermissions", ["role_permissions_role_permission_unique"]],
      ["roleDataPermissions", ["role_data_permissions_role_permission_unique"]],
      ["fieldPermissionRules", ["field_permission_rules_target_field_unique"]],
      ["userPermissionOverrides", ["user_permission_overrides_user_permission_unique"]],
      ["menus", ["menus_code_unique", "menus_path_unique"]],
      ["routeMetadata", ["route_metadata_route_code_unique"]],
      ["apiPermissions", ["api_permissions_code_unique", "api_permissions_method_path_unique"]],
      ["menuApiBindings", ["menu_api_bindings_unique"]],
      ["authSessions", ["auth_sessions_user_active_idx"]],
      ["refreshTokens", ["refresh_tokens_hash_unique"]],
      ["cacheEntries", ["cache_entries_expires_at_idx", "cache_entries_key_unique"]],
      [
        "rateLimitCounters",
        ["rate_limit_counters_expires_at_idx", "rate_limit_counters_key_window_unique"],
      ],
      ["locks", ["locks_expires_at_idx", "locks_key_unique"]],
      ["queueJobs", ["queue_jobs_status_available_idx"]],
      ["eventOutbox", ["event_outbox_status_next_run_idx"]],
      ["scheduledJobs", ["scheduled_jobs_code_unique", "scheduled_jobs_next_run_idx"]],
      ["fileObjects", ["file_objects_object_key_unique"]],
      ["fileReferences", ["file_references_file_idx", "file_references_resource_idx"]],
      ["notifications", ["notifications_user_status_idx"]],
      ["notificationTemplates", ["notification_templates_code_locale_unique"]],
      ["logEntries", ["log_entries_type_occurred_idx"]],
      ["importExportTasks", ["import_export_tasks_status_idx"]],
      ["systemConfigs", ["system_configs_group_idx", "system_configs_key_unique"]],
      ["dictionaryTypes", ["dictionary_types_code_unique"]],
      ["dictionaryItems", ["dictionary_items_type_idx", "dictionary_items_type_value_unique"]],
      ["i18nMessages", ["i18n_messages_key_language_unique", "i18n_messages_module_idx"]],
      ["announcements", ["announcements_status_idx"]],
      ["webhookSubscriptions", ["webhook_subscriptions_status_idx"]],
    ]);

    for (const [tableName, expectedIndexes] of expectedIndexesByTable) {
      expect(getIndexNames(sqlite[tableName])).toEqual(expectedIndexes);
      expect(getIndexNames(postgresql[tableName])).toEqual(expectedIndexes);
    }
  });
});
