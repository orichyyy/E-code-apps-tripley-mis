import {
  createInMemoryCacheAdapter,
  createInMemoryTokenStoreAdapter,
  type CacheAdapter,
} from "@web-admin-base/adapters";
import type {
  BusinessModuleDefinition,
  ChangePasswordRequest,
  CreateMenuRequest,
  CreateOrganizationRequest,
  CreateRoleRequest,
  InitializationSetupRequest,
  ResetPasswordRequest,
  SwitchCurrentOrganizationRequest,
  UpdateMenuApiBindingsRequest,
  UpdateMenuRequest,
  UpdateOrganizationDepthConfigRequest,
  UpdateOrganizationRequest,
  UpdateOwnAvatarRequest,
  UpdateOwnPreferencesRequest,
  UpdateOwnProfileRequest,
  UpdateRoleRequest,
  UpdateUserRequest,
  WebhookOutboxEvent,
} from "@web-admin-base/contracts";

import { PermissionCache } from "../../permissions/permission-cache";
import type { AuthService, OnlineUserListFilters } from "../auth.service";
import { BackendCoreServices } from "../services";
import { defaultBackendCoreConfig, type BackendCoreConfig } from "../service-context";
import {
  BackendCorePersistenceCoordinator,
  type PersistenceScope,
} from "./backend-core-persistence-coordinator";
import { BackendCoreStoreRepository } from "./backend-core-store-repository";
import { WebhookAwareBackendCoreServices } from "./webhook-aware-backend-core-services";

export class PersistentBackendCoreServices extends WebhookAwareBackendCoreServices {
  private readonly persistence: BackendCorePersistenceCoordinator;

  private constructor(
    private readonly repository: BackendCoreStoreRepository,
    context: ConstructorParameters<typeof BackendCoreServices>[0],
    private readonly webhookEventsEnabled: boolean,
  ) {
    super(context);
    this.persistence = new BackendCorePersistenceCoordinator(repository, () => this.context.store);
  }

  static async create(
    repository: BackendCoreStoreRepository,
    config?: Partial<BackendCoreConfig>,
    options: { permissionCacheAdapter?: CacheAdapter; webhookEventsEnabled?: boolean } = {},
  ): Promise<PersistentBackendCoreServices> {
    const store = await repository.load();
    const tokenStore = createInMemoryTokenStoreAdapter();
    for (const token of store.refreshTokens.values()) {
      await tokenStore.store({
        tokenHash: token.tokenHash,
        subjectId: token.userId,
        sessionId: token.sessionId,
        tokenVersion: token.tokenVersion,
        expiresAt: token.expiresAt,
        createdAt: token.createdAt,
        revokedAt: token.revokedAt,
      });
    }
    return new PersistentBackendCoreServices(
      repository,
      {
        store,
        permissionCache: new PermissionCache(
          options.permissionCacheAdapter ?? createInMemoryCacheAdapter(),
        ),
        tokenStore,
        config: {
          ...defaultBackendCoreConfig,
          ...config,
        },
      },
      options.webhookEventsEnabled ?? false,
    );
  }

  close(): Promise<void> {
    return this.persistence.flush().then(() => this.repository.close());
  }

  override async initialize(input: InitializationSetupRequest) {
    return this.persistAfter(() => super.initialize(input), ["all"]);
  }

  override async seedInitialization(input: InitializationSetupRequest) {
    return this.persistAfter(() => super.seedInitialization(input), ["all"]);
  }

  override async refreshBusinessModuleMetadata(
    _definitions: BusinessModuleDefinition[],
  ): Promise<void> {
    const reloaded = await this.repository.load();
    replaceMap(this.context.store.permissions, reloaded.permissions);
    replaceMap(this.context.store.apiPermissions, reloaded.apiPermissions);
    replaceMap(this.context.store.routeMetadata, reloaded.routeMetadata);
    replaceMap(this.context.store.menus, reloaded.menus);
    replaceMap(this.context.store.menuApiBindings, reloaded.menuApiBindings);
    replaceMap(this.context.store.roleDataPermissions, reloaded.roleDataPermissions);
    replaceMap(this.context.store.userPermissionOverrides, reloaded.userPermissionOverrides);
    this.context.store.rolePermissions.splice(
      0,
      this.context.store.rolePermissions.length,
      ...reloaded.rolePermissions,
    );
    const activeModuleCodes = new Set(_definitions.map((definition) => definition.moduleCode));
    for (const permission of this.context.store.permissions.values()) {
      if (permission.source === "business_module" && !activeModuleCodes.has(permission.module)) {
        permission.status = "disabled";
      }
    }
    for (const api of this.context.store.apiPermissions.values()) {
      if (api.source === "business_module" && !activeModuleCodes.has(api.module)) {
        api.status = "disabled";
      }
    }
    for (const route of this.context.store.routeMetadata.values()) {
      if (route.source === "business_module" && !activeModuleCodes.has(route.ownerModule ?? "")) {
        route.status = "disabled";
      }
    }
    for (const menu of this.context.store.menus.values()) {
      if (menu.source === "business_module" && !activeModuleCodes.has(menu.ownerModule ?? "")) {
        menu.status = "disabled";
      }
    }
    const enabledCodes = new Set(
      [...this.context.store.permissions.values()]
        .filter((permission) => permission.status === "enabled")
        .map((permission) => permission.code),
    );
    const retained = this.context.store.rolePermissions.filter((binding) =>
      enabledCodes.has(binding.permissionCode),
    );
    this.context.store.rolePermissions.splice(
      0,
      this.context.store.rolePermissions.length,
      ...retained,
    );
    await this.permissions.invalidateAllPermissionContexts();
  }

  override async login(
    input: Parameters<BackendCoreServices["login"]>[0],
    request: Parameters<BackendCoreServices["login"]>[1],
  ) {
    return this.persistAfter(() => super.login(input, request), ["users", "authSessions"]);
  }

  override async refreshAccessToken(refreshToken: string) {
    return this.persistAfter(() => super.refreshAccessToken(refreshToken), ["authSessions"]);
  }

  override async changePassword(
    authContext: NonNullable<ReturnType<AuthService["findAuthContext"]>>,
    input: ChangePasswordRequest,
  ) {
    return this.persistAfter(() => super.changePassword(authContext, input), ["users"]);
  }

  override async switchCurrentOrganization(
    authContext: NonNullable<ReturnType<AuthService["findAuthContext"]>>,
    input: SwitchCurrentOrganizationRequest,
  ) {
    return this.persistAfter(
      () => super.switchCurrentOrganization(authContext, input),
      ["authSessions"],
    );
  }

  override logout(sessionId: string) {
    return this.persistAfter(() => super.logout(sessionId), ["authSessions"]);
  }

  override listOnlineUsers(filters: OnlineUserListFilters = {}) {
    return this.persistSync(() => super.listOnlineUsers(filters), ["authSessions"]);
  }

  override async updateOwnProfile(
    authContext: NonNullable<ReturnType<AuthService["findAuthContext"]>>,
    input: UpdateOwnProfileRequest,
  ) {
    return this.persistAfter(
      () => super.updateOwnProfile(authContext, input),
      ["users", "userPreferences"],
    );
  }

  override async updateOwnPreferences(
    authContext: NonNullable<ReturnType<AuthService["findAuthContext"]>>,
    input: UpdateOwnPreferencesRequest,
  ) {
    return this.persistAfter(
      () => super.updateOwnPreferences(authContext, input),
      ["userPreferences"],
    );
  }

  override async updateOwnAvatar(
    authContext: NonNullable<ReturnType<AuthService["findAuthContext"]>>,
    input: UpdateOwnAvatarRequest,
  ) {
    return this.persistAfter(
      () => super.updateOwnAvatar(authContext, input),
      ["users", "userPreferences"],
    );
  }

  override updateOrganizationDepthConfig(input: UpdateOrganizationDepthConfigRequest) {
    return super.updateOrganizationDepthConfig(input);
  }

  override async createOrganization(
    input: CreateOrganizationRequest,
    actorId: string | null = null,
  ) {
    return this.persistAfter(() => super.createOrganization(input, actorId), ["organizations"]);
  }

  override async updateOrganization(
    id: string,
    input: UpdateOrganizationRequest,
    actorId: string | null = null,
  ) {
    return this.persistAfter(() => super.updateOrganization(id, input, actorId), ["organizations"]);
  }

  override async disableOrganization(id: string, actorId: string | null = null) {
    return this.persistAfter(() => super.disableOrganization(id, actorId), ["organizations"]);
  }

  override async enableOrganization(id: string, actorId: string | null = null) {
    return this.persistAfter(() => super.enableOrganization(id, actorId), ["organizations"]);
  }

  override async deleteOrganization(id: string, deletedBy: string | null = null) {
    return this.persistAfter(
      () => super.deleteOrganization(id, deletedBy),
      ["organizations", "userOrganizationRoles"],
    );
  }

  override async updateUser(id: string, input: UpdateUserRequest, actorId: string | null = null) {
    return this.persistAfter(
      () => super.updateUser(id, input, actorId),
      ["users", "userOrganizationRoles"],
    );
  }

  override async setUserStatus(
    id: string,
    status: "enabled" | "disabled" | "locked",
    actorId: string | null = null,
  ) {
    return this.persistAfter(() => super.setUserStatus(id, status, actorId), ["users"]);
  }

  override async resetUserPassword(
    id: string,
    input: ResetPasswordRequest,
    actorId: string | null = null,
  ) {
    return this.persistAfter(() => super.resetUserPassword(id, input, actorId), ["users"]);
  }

  override async deleteUser(id: string, deletedBy: string | null = null) {
    return this.persistAfter(
      () => super.deleteUser(id, deletedBy),
      ["users", "userOrganizationRoles"],
    );
  }

  override createRole(input: CreateRoleRequest, actorId: string | null = null) {
    return this.persistSync(() => super.createRole(input, actorId), ["roles"]);
  }

  override async updateRole(id: string, input: UpdateRoleRequest, actorId: string | null = null) {
    return this.persistAfter(() => super.updateRole(id, input, actorId), ["roles"]);
  }

  override async setRoleStatus(
    id: string,
    status: "enabled" | "disabled",
    actorId: string | null = null,
  ) {
    return this.persistAfter(() => super.setRoleStatus(id, status, actorId), ["roles"]);
  }

  override copyRole(id: string, actorId: string | null = null) {
    return this.persistSync(() => super.copyRole(id, actorId), ["roles"]);
  }

  override async deleteRole(id: string, deletedBy: string | null = null) {
    return this.persistAfter(
      () => super.deleteRole(id, deletedBy),
      ["roles", "userOrganizationRoles"],
    );
  }

  override async syncRoutes() {
    return this.persistAfter(() => super.syncRoutes(), ["routeMetadata"]);
  }

  override async createMenu(input: CreateMenuRequest) {
    return this.persistAfter(() => super.createMenu(input), ["menus"]);
  }

  override async updateMenu(id: string, input: UpdateMenuRequest) {
    return this.persistAfter(() => super.updateMenu(id, input), ["menus"]);
  }

  override async deleteMenu(id: string, deletedBy: string | null = null) {
    return this.persistAfter(() => super.deleteMenu(id, deletedBy), ["menus"]);
  }

  override async updateMenuApiBindings(id: string, input: UpdateMenuApiBindingsRequest) {
    return this.persistAfter(() => super.updateMenuApiBindings(id, input), ["menus"]);
  }

  protected override async persistAfter<T>(
    operation: () => T | Promise<T>,
    scopes: PersistenceScope[],
    eventFactory?: (result: Awaited<T>) => WebhookOutboxEvent | null,
  ): Promise<Awaited<T>> {
    return this.persistence.persistAfter(
      operation,
      scopes,
      this.webhookEventsEnabled ? eventFactory : undefined,
    );
  }

  private persistSync<T>(operation: () => T, scopes: PersistenceScope[]): T {
    return this.persistence.persistSync(operation, scopes);
  }
}

function replaceMap<K, V>(target: Map<K, V>, source: Map<K, V>): void {
  target.clear();
  for (const [key, value] of source) target.set(key, value);
}

export async function createPersistentBackendCoreServices(
  config?: Partial<BackendCoreConfig>,
  repository = BackendCoreStoreRepository.fromEnvironment(),
  options: { permissionCacheAdapter?: CacheAdapter; webhookEventsEnabled?: boolean } = {},
) {
  return PersistentBackendCoreServices.create(repository, config, options);
}
