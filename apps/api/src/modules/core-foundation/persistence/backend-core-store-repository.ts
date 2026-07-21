import { loadDatabaseConfig } from "@web-admin-base/db";
import type { DatabaseConfig } from "@web-admin-base/db";
import { webhookOutboxEventSchema, type WebhookOutboxEvent } from "@web-admin-base/contracts";

import { InMemoryBackendStore } from "../in-memory-store";
import { BackendCoreAggregateRepositories } from "./backend-core-aggregate-repositories";
import {
  createPostgresqlExecutor,
  createSqliteExecutor,
  type QueryExecutor,
} from "./query-executor";
import {
  authSessionStatus,
  bigint,
  booleanValue,
  dataPermissionEffect,
  dataPermissionRule,
  entityStatus,
  fieldPermissionEffect,
  fieldPermissionScenario,
  id,
  initializationStatus,
  iso,
  jsonRecord,
  jsonValue,
  logLevel,
  normalizeParam,
  nullableId,
  nullableIso,
  nullableString,
  numberValue,
  permissionType,
  placeholders,
  rolePermissionEffect,
  setSequence,
  stringValue,
  userPreferenceLanguage,
  userPreferenceThemeColor,
  userPreferenceThemeMode,
  userStatus,
} from "./row-values";

export class BackendCoreStoreRepository {
  readonly aggregates: BackendCoreAggregateRepositories;

  constructor(private readonly executor: QueryExecutor) {
    this.aggregates = new BackendCoreAggregateRepositories(executor);
  }

  static fromEnvironment(env: NodeJS.ProcessEnv = process.env): BackendCoreStoreRepository {
    return BackendCoreStoreRepository.fromConfig(loadDatabaseConfig(env));
  }

  static fromConfig(config: DatabaseConfig): BackendCoreStoreRepository {
    if (config.dialect === "postgresql") {
      return new BackendCoreStoreRepository(createPostgresqlExecutor(config.url));
    }
    return new BackendCoreStoreRepository(createSqliteExecutor(config.url));
  }

  async close(): Promise<void> {
    await this.executor.close();
  }

  transaction<T>(operation: () => Promise<T>): Promise<T> {
    return this.executor.transaction(operation);
  }

  async appendWebhookEvent(event: WebhookOutboxEvent): Promise<void> {
    const value = webhookOutboxEventSchema.parse(event);
    const marker = (index: number) => (this.executor.dialect === "postgresql" ? `$${index}` : "?");
    await this.executor.run(
      `INSERT INTO event_outbox
       (event_type, payload_json, status, attempt, max_attempts, occurred_at, created_at, updated_at)
       VALUES (${marker(1)}, ${marker(2)}, 'pending', 0, 1, ${marker(3)}, ${marker(4)}, ${marker(5)})`,
      [
        value.type,
        this.executor.dialect === "sqlite" ? JSON.stringify(value) : value,
        value.occurredAt,
        value.occurredAt,
        value.occurredAt,
      ],
    );
  }

  async load(): Promise<InMemoryBackendStore> {
    const store = new InMemoryBackendStore();
    await this.loadOrganizations(store);
    await this.loadUsers(store);
    await this.loadUserPreferences(store);
    await this.loadRoles(store);
    await this.loadPermissions(store);
    await this.loadApiPermissions(store);
    await this.loadMenus(store);
    await this.loadMenuApiBindings(store);
    await this.loadRouteMetadata(store);
    await this.loadUserOrganizationRoles(store);
    await this.loadAuthSessions(store);
    await this.loadRefreshTokens(store);
    await this.loadRolePermissions(store);
    await this.loadRoleDataPermissions(store);
    await this.loadFieldPermissionRules(store);
    await this.loadUserPermissionOverrides(store);
    await this.loadInitializationState(store);
    this.hydrateSequences(store);
    return store;
  }

  async save(store: InMemoryBackendStore): Promise<void> {
    await this.executor.transaction(async () => {
      await this.clearTables();
      await this.saveOrganizations(store);
      await this.saveUsers(store);
      await this.saveUserPreferences(store);
      await this.saveRoles(store);
      await this.savePermissions(store);
      await this.saveApiPermissions(store);
      await this.saveMenus(store);
      await this.saveMenuApiBindings(store);
      await this.saveRouteMetadata(store);
      await this.saveUserOrganizationRoles(store);
      await this.saveAuthSessions(store);
      await this.saveRefreshTokens(store);
      await this.saveRolePermissions(store);
      await this.savePermissionExtensions(store);
      await this.saveInitializationState(store);
    });
  }

  private async clearTables(): Promise<void> {
    for (const table of [
      "menu_api_bindings",
      "user_permission_overrides",
      "field_permission_rules",
      "role_data_permissions",
      "role_permissions",
      "user_organization_roles",
      "refresh_tokens",
      "auth_sessions",
      "system_initialization_state",
      "menus",
      "route_metadata",
      "api_permissions",
      "permissions",
      "roles",
      "user_preferences",
      "users",
      "organizations",
    ]) {
      await this.executor.run(`DELETE FROM ${table}`);
    }
  }

  private async loadOrganizations(store: InMemoryBackendStore): Promise<void> {
    const rows = await this.executor.all("SELECT * FROM organizations ORDER BY id");
    rows.forEach((row) =>
      store.organizations.set(id(row.id), {
        id: id(row.id),
        tenantId: nullableId(row.tenant_id),
        path: bigint(row.path),
        level: numberValue(row.level),
        segment: numberValue(row.segment),
        name: stringValue(row.name),
        code: stringValue(row.code),
        managerUserId: nullableId(row.manager_user_id),
        phone: nullableString(row.phone),
        email: nullableString(row.email),
        address: nullableString(row.address),
        sortOrder: numberValue(row.sort_order),
        status: entityStatus(row.status),
        remark: nullableString(row.remark),
        isDeleted: booleanValue(row.is_deleted),
        deletedAt: nullableIso(row.deleted_at),
        deletedBy: nullableId(row.deleted_by),
        createdAt: iso(row.created_at),
        updatedAt: iso(row.updated_at),
        createdBy: nullableId(row.created_by),
        updatedBy: nullableId(row.updated_by),
      }),
    );
  }

  private async loadUsers(store: InMemoryBackendStore): Promise<void> {
    const rows = await this.executor.all("SELECT * FROM users ORDER BY id");
    rows.forEach((row) =>
      store.users.set(id(row.id), {
        id: id(row.id),
        tenantId: nullableId(row.tenant_id),
        username: stringValue(row.username),
        displayName: stringValue(row.display_name),
        email: stringValue(row.email),
        phone: stringValue(row.phone),
        avatarFileId: nullableId(row.avatar_file_id),
        gender: nullableString(row.gender),
        employeeNumber: nullableString(row.employee_number),
        passwordHash: stringValue(row.password_hash),
        primaryOrganizationId: id(row.primary_organization_id),
        status: userStatus(row.status),
        firstLoginPasswordChangeRequired: booleanValue(row.first_login_password_change_required),
        passwordChangedAt: nullableIso(row.password_changed_at),
        passwordExpiresAt: nullableIso(row.password_expires_at),
        failedLoginAttempts: numberValue(row.failed_login_attempts),
        lockedUntil: nullableIso(row.locked_until),
        tokenVersion: numberValue(row.token_version),
        lastLoginAt: nullableIso(row.last_login_at),
        remark: nullableString(row.remark),
        isDeleted: booleanValue(row.is_deleted),
        deletedAt: nullableIso(row.deleted_at),
        deletedBy: nullableId(row.deleted_by),
        createdAt: iso(row.created_at),
        updatedAt: iso(row.updated_at),
        createdBy: nullableId(row.created_by),
        updatedBy: nullableId(row.updated_by),
      }),
    );
  }

  private async loadUserPreferences(store: InMemoryBackendStore): Promise<void> {
    const rows = await this.executor.all("SELECT * FROM user_preferences ORDER BY id");
    rows.forEach((row) =>
      store.userPreferences.set(id(row.id), {
        id: id(row.id),
        tenantId: nullableId(row.tenant_id),
        userId: id(row.user_id),
        language: userPreferenceLanguage(row.language),
        themeMode: userPreferenceThemeMode(row.theme_mode),
        themeColor: userPreferenceThemeColor(row.theme_color),
        pageTabsEnabled: booleanValue(row.page_tabs_enabled),
        updatedAt: iso(row.updated_at),
      }),
    );
  }

  private async loadRoles(store: InMemoryBackendStore): Promise<void> {
    const rows = await this.executor.all("SELECT * FROM roles ORDER BY id");
    rows.forEach((row) =>
      store.roles.set(id(row.id), {
        id: id(row.id),
        tenantId: nullableId(row.tenant_id),
        name: stringValue(row.name),
        code: stringValue(row.code),
        description: nullableString(row.description),
        dataScopeRuleId: nullableId(row.data_scope_rule_id),
        isBuiltin: booleanValue(row.is_builtin),
        status: entityStatus(row.status),
        remark: nullableString(row.remark),
        isDeleted: booleanValue(row.is_deleted),
        deletedAt: nullableIso(row.deleted_at),
        deletedBy: nullableId(row.deleted_by),
        createdAt: iso(row.created_at),
        updatedAt: iso(row.updated_at),
        createdBy: nullableId(row.created_by),
        updatedBy: nullableId(row.updated_by),
      }),
    );
  }

  private async loadPermissions(store: InMemoryBackendStore): Promise<void> {
    const rows = await this.executor.all("SELECT * FROM permissions ORDER BY id");
    rows.forEach((row) =>
      store.permissions.set(id(row.id), {
        id: id(row.id),
        tenantId: nullableId(row.tenant_id),
        code: stringValue(row.code),
        name: stringValue(row.name),
        permissionType: permissionType(row.permission_type),
        resource: stringValue(row.resource),
        action: stringValue(row.action),
        description: nullableString(row.description),
        module: stringValue(row.module),
        source: stringValue(row.source),
        manifestHash: stringValue(row.manifest_hash),
        status: entityStatus(row.status),
        createdAt: iso(row.created_at),
        updatedAt: iso(row.updated_at),
      }),
    );
  }

  private async loadApiPermissions(store: InMemoryBackendStore): Promise<void> {
    const rows = await this.executor.all("SELECT * FROM api_permissions ORDER BY id");
    rows.forEach((row) =>
      store.apiPermissions.set(id(row.id), {
        id: id(row.id),
        tenantId: nullableId(row.tenant_id),
        method: stringValue(row.method),
        path: stringValue(row.path),
        code: stringValue(row.code),
        description: nullableString(row.description),
        module: stringValue(row.module),
        requiredPermission: nullableString(row.required_permission),
        logLevel: logLevel(row.log_level),
        public: booleanValue(row.public),
        source: stringValue(row.source),
        manifestHash: nullableString(row.manifest_hash),
        status: entityStatus(row.status),
        createdAt: iso(row.created_at),
        updatedAt: iso(row.updated_at),
      }),
    );
  }

  private async loadMenus(store: InMemoryBackendStore): Promise<void> {
    const rows = await this.executor.all("SELECT * FROM menus ORDER BY id");
    rows.forEach((row) =>
      store.menus.set(id(row.id), {
        id: id(row.id),
        tenantId: nullableId(row.tenant_id),
        parentMenuId: nullableId(row.parent_menu_id),
        code: stringValue(row.code),
        titleI18nKey: stringValue(row.title_i18n_key),
        path: stringValue(row.path),
        requiredPermission: nullableString(row.permission_code),
        routeCode: nullableString(row.route_code),
        icon: nullableString(row.icon),
        sortOrder: numberValue(row.sort_order),
        visible: booleanValue(row.visible),
        status: entityStatus(row.status),
        source: stringValue(row.source),
        ownerModule: nullableString(row.owner_module),
        isDeleted: booleanValue(row.is_deleted),
        deletedAt: nullableIso(row.deleted_at),
        deletedBy: nullableId(row.deleted_by),
        createdAt: iso(row.created_at),
        updatedAt: iso(row.updated_at),
      }),
    );
  }

  private async loadMenuApiBindings(store: InMemoryBackendStore): Promise<void> {
    const rows = await this.executor.all("SELECT * FROM menu_api_bindings ORDER BY id");
    rows.forEach((row) =>
      store.menuApiBindings.set(id(row.id), {
        id: id(row.id),
        tenantId: nullableId(row.tenant_id),
        menuId: id(row.menu_id),
        apiPermissionId: id(row.api_permission_id),
        createdAt: iso(row.created_at),
      }),
    );
  }

  private async loadRouteMetadata(store: InMemoryBackendStore): Promise<void> {
    const rows = await this.executor.all("SELECT * FROM route_metadata ORDER BY id");
    rows.forEach((row) =>
      store.routeMetadata.set(id(row.id), {
        id: id(row.id),
        tenantId: nullableId(row.tenant_id),
        routeCode: stringValue(row.route_code),
        path: stringValue(row.path),
        titleI18nKey: stringValue(row.title_i18n_key),
        requiredPermission: nullableString(row.required_permission),
        metadataJson: jsonRecord(row.metadata_json),
        manifestHash: stringValue(row.manifest_hash),
        menuVisible: booleanValue(row.menu_visible),
        icon: nullableString(row.icon),
        sortOrder: numberValue(row.sort_order),
        status: entityStatus(row.status),
        source: stringValue(row.source),
        ownerModule: nullableString(row.owner_module),
        createdAt: iso(row.created_at),
        updatedAt: iso(row.updated_at),
      }),
    );
  }

  private async loadUserOrganizationRoles(store: InMemoryBackendStore): Promise<void> {
    const rows = await this.executor.all("SELECT * FROM user_organization_roles ORDER BY id");
    rows.forEach((row) =>
      store.userOrganizationRoles.set(id(row.id), {
        id: id(row.id),
        tenantId: nullableId(row.tenant_id),
        userId: id(row.user_id),
        organizationId: id(row.organization_id),
        roleId: id(row.role_id),
        isPrimary: booleanValue(row.is_primary),
        status: entityStatus(row.status),
        isDeleted: booleanValue(row.is_deleted),
        deletedAt: nullableIso(row.deleted_at),
        deletedBy: nullableId(row.deleted_by),
        createdAt: iso(row.created_at),
        updatedAt: iso(row.updated_at),
        createdBy: nullableId(row.created_by),
        updatedBy: nullableId(row.updated_by),
      }),
    );
  }

  private async loadAuthSessions(store: InMemoryBackendStore): Promise<void> {
    const rows = await this.executor.all("SELECT * FROM auth_sessions ORDER BY id");
    rows.forEach((row) =>
      store.authSessions.set(id(row.id), {
        id: id(row.id),
        tenantId: nullableId(row.tenant_id),
        userId: id(row.user_id),
        refreshTokenHash: stringValue(row.refresh_token_hash),
        currentOrganizationId: id(row.current_organization_id),
        tokenVersion: numberValue(row.token_version),
        status: authSessionStatus(row.status),
        ipAddress: nullableString(row.ip_address),
        userAgent: nullableString(row.user_agent),
        expiresAt: iso(row.expires_at),
        revokedAt: nullableIso(row.revoked_at),
        createdAt: iso(row.created_at),
        lastSeenAt: iso(row.last_seen_at),
      }),
    );
  }

  private async loadRefreshTokens(store: InMemoryBackendStore): Promise<void> {
    const rows = await this.executor.all("SELECT * FROM refresh_tokens ORDER BY id");
    rows.forEach((row) =>
      store.refreshTokens.set(id(row.id), {
        id: id(row.id),
        tenantId: nullableId(row.tenant_id),
        sessionId: id(row.session_id),
        userId: id(row.user_id),
        tokenHash: stringValue(row.token_hash),
        tokenVersion: numberValue(row.token_version),
        expiresAt: iso(row.expires_at),
        revokedAt: nullableIso(row.revoked_at),
        createdAt: iso(row.created_at),
      }),
    );
  }

  private async loadRolePermissions(store: InMemoryBackendStore): Promise<void> {
    const rows = await this.executor.all(
      `SELECT rp.role_id, rp.effect, rp.created_at, rp.updated_at, p.code AS permission_code
       FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
       ORDER BY rp.id`,
    );
    rows.forEach((row) =>
      store.rolePermissions.push({
        roleId: id(row.role_id),
        permissionCode: stringValue(row.permission_code),
        effect: rolePermissionEffect(row.effect),
        createdAt: iso(row.created_at),
        updatedAt: iso(row.updated_at),
      }),
    );
  }

  private async loadRoleDataPermissions(store: InMemoryBackendStore): Promise<void> {
    const rows = await this.executor.all(
      `SELECT rdp.*, p.code AS permission_code
       FROM role_data_permissions rdp
       JOIN permissions p ON p.id = rdp.permission_id
       ORDER BY rdp.id`,
    );
    rows.forEach((row) =>
      store.roleDataPermissions.set(id(row.id), {
        id: id(row.id),
        tenantId: nullableId(row.tenant_id),
        roleId: id(row.role_id),
        permissionId: id(row.permission_id),
        permissionCode: stringValue(row.permission_code),
        effect: dataPermissionEffect(row.effect),
        rule: dataPermissionRule(row.rule_json),
        isDeleted: booleanValue(row.is_deleted),
        deletedAt: nullableIso(row.deleted_at),
        deletedBy: nullableId(row.deleted_by),
        createdAt: iso(row.created_at),
        updatedAt: iso(row.updated_at),
        createdBy: nullableId(row.created_by),
        updatedBy: nullableId(row.updated_by),
      }),
    );
  }

  private async loadFieldPermissionRules(store: InMemoryBackendStore): Promise<void> {
    const rows = await this.executor.all("SELECT * FROM field_permission_rules ORDER BY id");
    rows.forEach((row) =>
      store.fieldPermissionRules.set(id(row.id), {
        id: id(row.id),
        tenantId: nullableId(row.tenant_id),
        targetType: "role",
        targetId: id(row.target_id),
        resource: stringValue(row.resource),
        field: stringValue(row.field),
        scenario: fieldPermissionScenario(row.scenario),
        effect: fieldPermissionEffect(row.effect),
        isDeleted: booleanValue(row.is_deleted),
        deletedAt: nullableIso(row.deleted_at),
        deletedBy: nullableId(row.deleted_by),
        createdAt: iso(row.created_at),
        updatedAt: iso(row.updated_at),
        createdBy: nullableId(row.created_by),
        updatedBy: nullableId(row.updated_by),
      }),
    );
  }

  private async loadUserPermissionOverrides(store: InMemoryBackendStore): Promise<void> {
    const rows = await this.executor.all(
      `SELECT upo.*, p.code AS permission_code
       FROM user_permission_overrides upo
       JOIN permissions p ON p.id = upo.permission_id
       ORDER BY upo.id`,
    );
    rows.forEach((row) =>
      store.userPermissionOverrides.set(id(row.id), {
        id: id(row.id),
        tenantId: nullableId(row.tenant_id),
        userId: id(row.user_id),
        permissionId: id(row.permission_id),
        permissionCode: stringValue(row.permission_code),
        effect: dataPermissionEffect(row.effect),
        isDeleted: booleanValue(row.is_deleted),
        deletedAt: nullableIso(row.deleted_at),
        deletedBy: nullableId(row.deleted_by),
        createdAt: iso(row.created_at),
        updatedAt: iso(row.updated_at),
        createdBy: nullableId(row.created_by),
        updatedBy: nullableId(row.updated_by),
      }),
    );
  }

  private async loadInitializationState(store: InMemoryBackendStore): Promise<void> {
    const rows = await this.executor.all(
      "SELECT * FROM system_initialization_state ORDER BY id LIMIT 1",
    );
    const row = rows[0];
    if (!row) return;
    store.initializationState = {
      id: id(row.id),
      tenantId: nullableId(row.tenant_id),
      status: initializationStatus(row.status),
      initializedAt: nullableIso(row.initialized_at),
      initializedBy: nullableId(row.initialized_by),
      version: stringValue(row.version),
      createdAt: iso(row.created_at),
      updatedAt: iso(row.updated_at),
    };
  }

  private hydrateSequences(store: InMemoryBackendStore): void {
    setSequence(store, "organization", store.organizations);
    setSequence(store, "user", store.users);
    setSequence(store, "userPreference", store.userPreferences);
    setSequence(store, "role", store.roles);
    setSequence(store, "permission", store.permissions);
    setSequence(store, "apiPermission", store.apiPermissions);
    setSequence(store, "menu", store.menus);
    setSequence(store, "menuApiBinding", store.menuApiBindings);
    setSequence(store, "routeMetadata", store.routeMetadata);
    setSequence(store, "userOrganizationRole", store.userOrganizationRoles);
    setSequence(store, "authSession", store.authSessions);
    setSequence(store, "refreshToken", store.refreshTokens);
    setSequence(store, "roleDataPermission", store.roleDataPermissions);
    setSequence(store, "fieldPermissionRule", store.fieldPermissionRules);
    setSequence(store, "userPermissionOverride", store.userPermissionOverrides);
    if (store.initializationState) {
      store.setSequenceValue("initializationState", Number(store.initializationState.id));
    }
  }

  private async saveOrganizations(store: InMemoryBackendStore): Promise<void> {
    await this.insertMany(
      "organizations",
      [
        "id",
        "tenant_id",
        "path",
        "level",
        "segment",
        "name",
        "code",
        "manager_user_id",
        "phone",
        "email",
        "address",
        "sort_order",
        "status",
        "remark",
        "is_deleted",
        "deleted_at",
        "deleted_by",
        "created_at",
        "updated_at",
        "created_by",
        "updated_by",
      ],
      [...store.organizations.values()].map((record) => [
        record.id,
        record.tenantId,
        record.path,
        record.level,
        record.segment,
        record.name,
        record.code,
        record.managerUserId,
        record.phone,
        record.email,
        record.address,
        record.sortOrder,
        record.status,
        record.remark,
        record.isDeleted,
        record.deletedAt,
        record.deletedBy,
        record.createdAt,
        record.updatedAt,
        record.createdBy,
        record.updatedBy,
      ]),
    );
  }

  private async saveUsers(store: InMemoryBackendStore): Promise<void> {
    await this.insertMany(
      "users",
      [
        "id",
        "tenant_id",
        "username",
        "display_name",
        "email",
        "phone",
        "avatar_file_id",
        "gender",
        "employee_number",
        "password_hash",
        "primary_organization_id",
        "status",
        "first_login_password_change_required",
        "password_changed_at",
        "password_expires_at",
        "failed_login_attempts",
        "locked_until",
        "token_version",
        "last_login_at",
        "remark",
        "is_deleted",
        "deleted_at",
        "deleted_by",
        "created_at",
        "updated_at",
        "created_by",
        "updated_by",
      ],
      [...store.users.values()].map((record) => [
        record.id,
        record.tenantId,
        record.username,
        record.displayName,
        record.email,
        record.phone,
        record.avatarFileId,
        record.gender,
        record.employeeNumber,
        record.passwordHash,
        record.primaryOrganizationId,
        record.status,
        record.firstLoginPasswordChangeRequired,
        record.passwordChangedAt,
        record.passwordExpiresAt,
        record.failedLoginAttempts,
        record.lockedUntil,
        record.tokenVersion,
        record.lastLoginAt,
        record.remark,
        record.isDeleted,
        record.deletedAt,
        record.deletedBy,
        record.createdAt,
        record.updatedAt,
        record.createdBy,
        record.updatedBy,
      ]),
    );
  }

  private async saveUserPreferences(store: InMemoryBackendStore): Promise<void> {
    await this.insertMany(
      "user_preferences",
      [
        "id",
        "tenant_id",
        "user_id",
        "language",
        "theme_mode",
        "theme_color",
        "page_tabs_enabled",
        "updated_at",
      ],
      [...store.userPreferences.values()].map((record) => [
        record.id,
        record.tenantId,
        record.userId,
        record.language,
        record.themeMode,
        record.themeColor,
        record.pageTabsEnabled,
        record.updatedAt,
      ]),
    );
  }

  private async saveRoles(store: InMemoryBackendStore): Promise<void> {
    await this.insertMany(
      "roles",
      [
        "id",
        "tenant_id",
        "name",
        "code",
        "description",
        "data_scope_rule_id",
        "is_builtin",
        "status",
        "remark",
        "is_deleted",
        "deleted_at",
        "deleted_by",
        "created_at",
        "updated_at",
        "created_by",
        "updated_by",
      ],
      [...store.roles.values()].map((record) => [
        record.id,
        record.tenantId,
        record.name,
        record.code,
        record.description,
        record.dataScopeRuleId,
        record.isBuiltin,
        record.status,
        record.remark,
        record.isDeleted,
        record.deletedAt,
        record.deletedBy,
        record.createdAt,
        record.updatedAt,
        record.createdBy,
        record.updatedBy,
      ]),
    );
  }

  private async savePermissions(store: InMemoryBackendStore): Promise<void> {
    await this.insertMany(
      "permissions",
      [
        "id",
        "tenant_id",
        "code",
        "name",
        "permission_type",
        "resource",
        "action",
        "description",
        "module",
        "source",
        "manifest_hash",
        "status",
        "created_at",
        "updated_at",
      ],
      [...store.permissions.values()].map((record) => [
        record.id,
        record.tenantId,
        record.code,
        record.name,
        record.permissionType,
        record.resource,
        record.action,
        record.description,
        record.module,
        record.source ?? "base_manifest",
        record.manifestHash ?? null,
        record.status,
        record.createdAt,
        record.updatedAt,
      ]),
    );
  }

  private async saveApiPermissions(store: InMemoryBackendStore): Promise<void> {
    await this.insertMany(
      "api_permissions",
      [
        "id",
        "tenant_id",
        "method",
        "path",
        "code",
        "description",
        "module",
        "required_permission",
        "log_level",
        "public",
        "source",
        "manifest_hash",
        "status",
        "created_at",
        "updated_at",
      ],
      [...store.apiPermissions.values()].map((record) => [
        record.id,
        record.tenantId,
        record.method,
        record.path,
        record.code,
        record.description,
        record.module,
        record.requiredPermission,
        record.logLevel,
        record.public,
        record.source,
        record.manifestHash,
        record.status,
        record.createdAt,
        record.updatedAt,
      ]),
    );
  }

  private async saveMenus(store: InMemoryBackendStore): Promise<void> {
    await this.insertMany(
      "menus",
      [
        "id",
        "tenant_id",
        "parent_menu_id",
        "permission_code",
        "code",
        "route_code",
        "title_i18n_key",
        "path",
        "icon",
        "sort_order",
        "visible",
        "status",
        "source",
        "owner_module",
        "is_deleted",
        "deleted_at",
        "deleted_by",
        "created_at",
        "updated_at",
      ],
      [...store.menus.values()].map((record) => [
        record.id,
        record.tenantId,
        record.parentMenuId,
        record.requiredPermission,
        record.code,
        record.routeCode,
        record.titleI18nKey,
        record.path,
        record.icon,
        record.sortOrder,
        record.visible,
        record.status,
        record.source ?? "manual",
        record.ownerModule,
        record.isDeleted,
        record.deletedAt,
        record.deletedBy,
        record.createdAt,
        record.updatedAt,
      ]),
    );
  }

  private async saveMenuApiBindings(store: InMemoryBackendStore): Promise<void> {
    await this.insertMany(
      "menu_api_bindings",
      ["id", "tenant_id", "menu_id", "api_permission_id", "created_at"],
      [...store.menuApiBindings.values()].map((record) => [
        record.id,
        record.tenantId,
        record.menuId,
        record.apiPermissionId,
        record.createdAt,
      ]),
    );
  }

  private async saveRouteMetadata(store: InMemoryBackendStore): Promise<void> {
    await this.insertMany(
      "route_metadata",
      [
        "id",
        "tenant_id",
        "route_code",
        "path",
        "title_i18n_key",
        "required_permission",
        "metadata_json",
        "manifest_hash",
        "menu_visible",
        "icon",
        "sort_order",
        "status",
        "source",
        "owner_module",
        "created_at",
        "updated_at",
      ],
      [...store.routeMetadata.values()].map((record) => [
        record.id,
        record.tenantId,
        record.routeCode,
        record.path,
        record.titleI18nKey,
        record.requiredPermission,
        jsonValue(record.metadataJson),
        record.manifestHash,
        record.menuVisible,
        record.icon,
        record.sortOrder,
        record.status,
        record.source ?? "base_manifest",
        record.ownerModule,
        record.createdAt,
        record.updatedAt,
      ]),
    );
  }

  private async saveUserOrganizationRoles(store: InMemoryBackendStore): Promise<void> {
    await this.insertMany(
      "user_organization_roles",
      [
        "id",
        "tenant_id",
        "user_id",
        "organization_id",
        "role_id",
        "is_primary",
        "status",
        "is_deleted",
        "deleted_at",
        "deleted_by",
        "created_at",
        "updated_at",
        "created_by",
        "updated_by",
      ],
      [...store.userOrganizationRoles.values()].map((record) => [
        record.id,
        record.tenantId,
        record.userId,
        record.organizationId,
        record.roleId,
        record.isPrimary,
        record.status,
        record.isDeleted,
        record.deletedAt,
        record.deletedBy,
        record.createdAt,
        record.updatedAt,
        record.createdBy,
        record.updatedBy,
      ]),
    );
  }

  private async saveAuthSessions(store: InMemoryBackendStore): Promise<void> {
    await this.insertMany(
      "auth_sessions",
      [
        "id",
        "tenant_id",
        "user_id",
        "refresh_token_hash",
        "current_organization_id",
        "token_version",
        "status",
        "ip_address",
        "user_agent",
        "expires_at",
        "revoked_at",
        "created_at",
        "last_seen_at",
      ],
      [...store.authSessions.values()].map((record) => [
        record.id,
        record.tenantId,
        record.userId,
        record.refreshTokenHash,
        record.currentOrganizationId,
        record.tokenVersion,
        record.status,
        record.ipAddress,
        record.userAgent,
        record.expiresAt,
        record.revokedAt,
        record.createdAt,
        record.lastSeenAt,
      ]),
    );
  }

  private async saveRefreshTokens(store: InMemoryBackendStore): Promise<void> {
    await this.insertMany(
      "refresh_tokens",
      [
        "id",
        "tenant_id",
        "session_id",
        "user_id",
        "token_hash",
        "token_version",
        "expires_at",
        "revoked_at",
        "created_at",
      ],
      [...store.refreshTokens.values()].map((record) => [
        record.id,
        record.tenantId,
        record.sessionId,
        record.userId,
        record.tokenHash,
        record.tokenVersion,
        record.expiresAt,
        record.revokedAt,
        record.createdAt,
      ]),
    );
  }

  private async saveRolePermissions(store: InMemoryBackendStore): Promise<void> {
    const permissionIdsByCode = new Map(
      [...store.permissions.values()].map((permission) => [permission.code, permission.id]),
    );
    await this.insertMany(
      "role_permissions",
      ["role_id", "permission_id", "effect", "created_at", "updated_at"],
      store.rolePermissions.flatMap((record) => {
        const permissionId = permissionIdsByCode.get(record.permissionCode);
        if (!permissionId) return [];
        return [[record.roleId, permissionId, record.effect, record.createdAt, record.updatedAt]];
      }),
    );
  }

  private async savePermissionExtensions(store: InMemoryBackendStore): Promise<void> {
    await this.aggregates.permissionExtensions.replaceFromStore(store);
  }

  private async saveInitializationState(store: InMemoryBackendStore): Promise<void> {
    const record = store.initializationState;
    await this.insertMany(
      "system_initialization_state",
      [
        "id",
        "tenant_id",
        "status",
        "initialized_at",
        "initialized_by",
        "version",
        "created_at",
        "updated_at",
      ],
      record
        ? [
            [
              record.id,
              record.tenantId,
              record.status,
              record.initializedAt,
              record.initializedBy,
              record.version,
              record.createdAt,
              record.updatedAt,
            ],
          ]
        : [],
    );
  }

  private async insertMany(table: string, columns: string[], rows: unknown[][]): Promise<void> {
    for (const row of rows) {
      await this.executor.run(
        `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders(row.length, this.executor.dialect)})`,
        row.map((value) => normalizeParam(value, this.executor.dialect)),
      );
    }
  }
}
