import {
  createInMemoryCacheAdapter,
  createInMemoryTokenStoreAdapter
} from "@web-admin-base/adapters";
import type {
  AssignUserOrganizationRoleRequest,
  ChangePasswordRequest,
  CreateMenuRequest,
  CreateOrganizationRequest,
  CreateRoleRequest,
  CreateUserRequest,
  InitializationSetupRequest,
  ResetPasswordRequest,
  SwitchCurrentOrganizationRequest,
  UpdateMenuApiBindingsRequest,
  UpdateMenuRequest,
  UpdateOrganizationDepthConfigRequest,
  UpdateOrganizationRequest,
  UpdateRolePermissionsRequest,
  UpdateRoleRequest,
  UpdateUserRequest
} from "@web-admin-base/contracts";

import { PermissionCache } from "../../permissions/permission-cache";
import type { AuthService, OnlineUserListFilters } from "../auth.service";
import { BackendCoreServices } from "../services";
import {
  defaultBackendCoreConfig,
  type BackendCoreConfig
} from "../service-context";
import { BackendCoreStoreRepository } from "./backend-core-store-repository";

type PersistenceScope =
  | "all"
  | "authSessions"
  | "initializationState"
  | "menus"
  | "organizations"
  | "permissions"
  | "roles"
  | "routeMetadata"
  | "userOrganizationRoles"
  | "users";

export class PersistentBackendCoreServices extends BackendCoreServices {
  private pendingSave: Promise<void> = Promise.resolve();

  private constructor(
    private readonly repository: BackendCoreStoreRepository,
    context: ConstructorParameters<typeof BackendCoreServices>[0]
  ) {
    super(context);
  }

  static async create(
    repository: BackendCoreStoreRepository,
    config?: Partial<BackendCoreConfig>
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
        revokedAt: token.revokedAt
      });
    }
    return new PersistentBackendCoreServices(repository, {
      store,
      permissionCache: new PermissionCache(createInMemoryCacheAdapter()),
      tokenStore,
      config: {
        ...defaultBackendCoreConfig,
        ...config
      }
    });
  }

  close(): Promise<void> {
    return this.flush().then(() => this.repository.close());
  }

  override async initialize(input: InitializationSetupRequest) {
    return this.persistAfter(() => super.initialize(input), ["all"]);
  }

  override async seedInitialization(input: InitializationSetupRequest) {
    return this.persistAfter(() => super.seedInitialization(input), ["all"]);
  }

  override async login(input: Parameters<BackendCoreServices["login"]>[0], request: Parameters<BackendCoreServices["login"]>[1]) {
    return this.persistAfter(() => super.login(input, request), ["users", "authSessions"]);
  }

  override async refreshAccessToken(refreshToken: string) {
    return this.persistAfter(() => super.refreshAccessToken(refreshToken), ["authSessions"]);
  }

  override async changePassword(
    authContext: NonNullable<ReturnType<AuthService["findAuthContext"]>>,
    input: ChangePasswordRequest
  ) {
    return this.persistAfter(() => super.changePassword(authContext, input), ["users"]);
  }

  override async switchCurrentOrganization(
    authContext: NonNullable<ReturnType<AuthService["findAuthContext"]>>,
    input: SwitchCurrentOrganizationRequest
  ) {
    return this.persistAfter(() => super.switchCurrentOrganization(authContext, input), ["authSessions"]);
  }

  override logout(sessionId: string) {
    return this.persistAfter(() => super.logout(sessionId), ["authSessions"]);
  }

  override listOnlineUsers(filters: OnlineUserListFilters = {}) {
    return this.persistSync(() => super.listOnlineUsers(filters), ["authSessions"]);
  }

  override updateOrganizationDepthConfig(input: UpdateOrganizationDepthConfigRequest) {
    return super.updateOrganizationDepthConfig(input);
  }

  override async createOrganization(input: CreateOrganizationRequest, actorId: string | null = null) {
    return this.persistAfter(() => super.createOrganization(input, actorId), ["organizations"]);
  }

  override async updateOrganization(
    id: string,
    input: UpdateOrganizationRequest,
    actorId: string | null = null
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
    return this.persistAfter(() => super.deleteOrganization(id, deletedBy), [
      "organizations",
      "userOrganizationRoles"
    ]);
  }

  override createUser(input: CreateUserRequest, actorId: string | null = null) {
    return this.persistSync(() => super.createUser(input, actorId), ["users", "userOrganizationRoles"]);
  }

  override async updateUser(id: string, input: UpdateUserRequest, actorId: string | null = null) {
    return this.persistAfter(() => super.updateUser(id, input, actorId), [
      "users",
      "userOrganizationRoles"
    ]);
  }

  override async setUserStatus(
    id: string,
    status: "enabled" | "disabled" | "locked",
    actorId: string | null = null
  ) {
    return this.persistAfter(() => super.setUserStatus(id, status, actorId), ["users"]);
  }

  override async resetUserPassword(
    id: string,
    input: ResetPasswordRequest,
    actorId: string | null = null
  ) {
    return this.persistAfter(() => super.resetUserPassword(id, input, actorId), ["users"]);
  }

  override async deleteUser(id: string, deletedBy: string | null = null) {
    return this.persistAfter(() => super.deleteUser(id, deletedBy), ["users", "userOrganizationRoles"]);
  }

  override async assignUserOrganizationRole(
    userId: string,
    input: AssignUserOrganizationRoleRequest,
    actorId: string | null = null
  ) {
    return this.persistAfter(() => super.assignUserOrganizationRole(userId, input, actorId), [
      "users",
      "userOrganizationRoles"
    ]);
  }

  override async removeUserOrganizationRole(
    userId: string,
    organizationId: string,
    deletedBy: string | null = null
  ) {
    return this.persistAfter(() => super.removeUserOrganizationRole(userId, organizationId, deletedBy), [
      "users",
      "userOrganizationRoles"
    ]);
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
    actorId: string | null = null
  ) {
    return this.persistAfter(() => super.setRoleStatus(id, status, actorId), ["roles"]);
  }

  override copyRole(id: string, actorId: string | null = null) {
    return this.persistSync(() => super.copyRole(id, actorId), ["roles"]);
  }

  override async updateRolePermissions(
    id: string,
    input: UpdateRolePermissionsRequest,
    actorId: string | null = null
  ) {
    return this.persistAfter(() => super.updateRolePermissions(id, input, actorId), ["roles"]);
  }

  override async deleteRole(id: string, deletedBy: string | null = null) {
    return this.persistAfter(() => super.deleteRole(id, deletedBy), [
      "roles",
      "userOrganizationRoles"
    ]);
  }

  override syncPermissions() {
    return this.persistAfter(() => super.syncPermissions(), ["permissions"]);
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

  private async persistAfter<T>(
    operation: () => T | Promise<T>,
    scopes: PersistenceScope[]
  ): Promise<Awaited<T>> {
    const result = await operation();
    await this.persistNow(scopes);
    return result;
  }

  private persistSync<T>(operation: () => T, scopes: PersistenceScope[]): T {
    const result = operation();
    this.enqueueSave(scopes);
    return result;
  }

  private async persistNow(scopes: PersistenceScope[]): Promise<void> {
    await this.flush();
    const save = this.persistScopes(scopes);
    this.pendingSave = save.catch(() => undefined);
    await save;
  }

  private enqueueSave(scopes: PersistenceScope[]): void {
    this.pendingSave = this.pendingSave.then(() => this.persistScopes(scopes));
  }

  flush(): Promise<void> {
    return this.pendingSave;
  }

  private async persistScopes(scopes: PersistenceScope[]): Promise<void> {
    const normalizedScopes = scopes.includes("all")
      ? (["all"] as PersistenceScope[])
      : [...new Set(scopes)];

    await this.repository.transaction(async () => {
      for (const scope of normalizedScopes) {
        await this.persistScope(scope);
      }
    });
  }

  private async persistScope(scope: PersistenceScope): Promise<void> {
    const store = this.getStore();

    switch (scope) {
      case "all":
        await this.repository.aggregates.replaceAllFromStore(store);
        return;
      case "authSessions":
        await this.repository.aggregates.authSessions.replaceFromStore(store);
        return;
      case "initializationState":
        await this.repository.aggregates.initializationState.replaceFromStore(store);
        return;
      case "menus":
        await this.repository.aggregates.menus.replaceFromStore(store);
        return;
      case "organizations":
        await this.repository.aggregates.organizations.replaceFromStore(store);
        return;
      case "permissions":
        await this.repository.aggregates.permissions.replaceFromStore(store);
        return;
      case "roles":
        await this.repository.aggregates.roles.replaceFromStore(store);
        return;
      case "routeMetadata":
        await this.repository.aggregates.routeMetadata.replaceFromStore(store);
        return;
      case "userOrganizationRoles":
        await this.repository.aggregates.userOrganizationRoles.replaceFromStore(store);
        return;
      case "users":
        await this.repository.aggregates.users.replaceFromStore(store);
        return;
    }
  }

  private getStore() {
    return this.context.store;
  }
}

export async function createPersistentBackendCoreServices(
  config?: Partial<BackendCoreConfig>,
  repository = BackendCoreStoreRepository.fromEnvironment()
) {
  return PersistentBackendCoreServices.create(repository, config);
}
