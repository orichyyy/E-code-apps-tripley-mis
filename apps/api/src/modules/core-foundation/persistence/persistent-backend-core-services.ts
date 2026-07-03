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
    return this.persistAfter(() => super.initialize(input));
  }

  override async seedInitialization(input: InitializationSetupRequest) {
    return this.persistAfter(() => super.seedInitialization(input));
  }

  override async login(input: Parameters<BackendCoreServices["login"]>[0], request: Parameters<BackendCoreServices["login"]>[1]) {
    return this.persistAfter(() => super.login(input, request));
  }

  override async refreshAccessToken(refreshToken: string) {
    return this.persistAfter(() => super.refreshAccessToken(refreshToken));
  }

  override async changePassword(
    authContext: NonNullable<ReturnType<AuthService["findAuthContext"]>>,
    input: ChangePasswordRequest
  ) {
    return this.persistAfter(() => super.changePassword(authContext, input));
  }

  override async switchCurrentOrganization(
    authContext: NonNullable<ReturnType<AuthService["findAuthContext"]>>,
    input: SwitchCurrentOrganizationRequest
  ) {
    return this.persistAfter(() => super.switchCurrentOrganization(authContext, input));
  }

  override logout(sessionId: string) {
    return this.persistAfter(() => super.logout(sessionId));
  }

  override listOnlineUsers(filters: OnlineUserListFilters = {}) {
    return this.persistSync(() => super.listOnlineUsers(filters));
  }

  override updateOrganizationDepthConfig(input: UpdateOrganizationDepthConfigRequest) {
    return this.persistSync(() => super.updateOrganizationDepthConfig(input));
  }

  override async createOrganization(input: CreateOrganizationRequest, actorId: string | null = null) {
    return this.persistAfter(() => super.createOrganization(input, actorId));
  }

  override async updateOrganization(
    id: string,
    input: UpdateOrganizationRequest,
    actorId: string | null = null
  ) {
    return this.persistAfter(() => super.updateOrganization(id, input, actorId));
  }

  override async disableOrganization(id: string, actorId: string | null = null) {
    return this.persistAfter(() => super.disableOrganization(id, actorId));
  }

  override async enableOrganization(id: string, actorId: string | null = null) {
    return this.persistAfter(() => super.enableOrganization(id, actorId));
  }

  override async deleteOrganization(id: string, deletedBy: string | null = null) {
    return this.persistAfter(() => super.deleteOrganization(id, deletedBy));
  }

  override createUser(input: CreateUserRequest, actorId: string | null = null) {
    return this.persistSync(() => super.createUser(input, actorId));
  }

  override async updateUser(id: string, input: UpdateUserRequest, actorId: string | null = null) {
    return this.persistAfter(() => super.updateUser(id, input, actorId));
  }

  override async setUserStatus(
    id: string,
    status: "enabled" | "disabled" | "locked",
    actorId: string | null = null
  ) {
    return this.persistAfter(() => super.setUserStatus(id, status, actorId));
  }

  override async resetUserPassword(
    id: string,
    input: ResetPasswordRequest,
    actorId: string | null = null
  ) {
    return this.persistAfter(() => super.resetUserPassword(id, input, actorId));
  }

  override async deleteUser(id: string, deletedBy: string | null = null) {
    return this.persistAfter(() => super.deleteUser(id, deletedBy));
  }

  override async assignUserOrganizationRole(
    userId: string,
    input: AssignUserOrganizationRoleRequest,
    actorId: string | null = null
  ) {
    return this.persistAfter(() => super.assignUserOrganizationRole(userId, input, actorId));
  }

  override async removeUserOrganizationRole(
    userId: string,
    organizationId: string,
    deletedBy: string | null = null
  ) {
    return this.persistAfter(() => super.removeUserOrganizationRole(userId, organizationId, deletedBy));
  }

  override createRole(input: CreateRoleRequest, actorId: string | null = null) {
    return this.persistSync(() => super.createRole(input, actorId));
  }

  override async updateRole(id: string, input: UpdateRoleRequest, actorId: string | null = null) {
    return this.persistAfter(() => super.updateRole(id, input, actorId));
  }

  override async setRoleStatus(
    id: string,
    status: "enabled" | "disabled",
    actorId: string | null = null
  ) {
    return this.persistAfter(() => super.setRoleStatus(id, status, actorId));
  }

  override copyRole(id: string, actorId: string | null = null) {
    return this.persistSync(() => super.copyRole(id, actorId));
  }

  override async updateRolePermissions(
    id: string,
    input: UpdateRolePermissionsRequest,
    actorId: string | null = null
  ) {
    return this.persistAfter(() => super.updateRolePermissions(id, input, actorId));
  }

  override async deleteRole(id: string, deletedBy: string | null = null) {
    return this.persistAfter(() => super.deleteRole(id, deletedBy));
  }

  override syncPermissions() {
    return this.persistAfter(() => super.syncPermissions());
  }

  override async syncRoutes() {
    return this.persistAfter(() => super.syncRoutes());
  }

  override async createMenu(input: CreateMenuRequest) {
    return this.persistAfter(() => super.createMenu(input));
  }

  override async updateMenu(id: string, input: UpdateMenuRequest) {
    return this.persistAfter(() => super.updateMenu(id, input));
  }

  override async deleteMenu(id: string, deletedBy: string | null = null) {
    return this.persistAfter(() => super.deleteMenu(id, deletedBy));
  }

  override async updateMenuApiBindings(id: string, input: UpdateMenuApiBindingsRequest) {
    return this.persistAfter(() => super.updateMenuApiBindings(id, input));
  }

  private async persistAfter<T>(operation: () => T | Promise<T>): Promise<Awaited<T>> {
    const result = await operation();
    await this.persistNow();
    return result;
  }

  private persistSync<T>(operation: () => T): T {
    const result = operation();
    this.enqueueSave();
    return result;
  }

  private async persistNow(): Promise<void> {
    await this.flush();
    const save = this.repository.save(this.getStore());
    this.pendingSave = save.catch(() => undefined);
    await save;
  }

  private enqueueSave(): void {
    this.pendingSave = this.pendingSave.then(() => this.repository.save(this.getStore()));
  }

  flush(): Promise<void> {
    return this.pendingSave;
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
