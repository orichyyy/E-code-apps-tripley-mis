import {
  createInMemoryCacheAdapter,
  createInMemoryTokenStoreAdapter,
} from "@web-admin-base/adapters";
import {
  baseMenuManifest,
  baseRouteManifest,
  type BaseApiPermissionManifestEntry,
} from "@web-admin-base/contracts";
import type {
  AssignUserOrganizationRoleRequest,
  ChangePasswordRequest,
  CreateOrganizationRequest,
  CreateRoleRequest,
  CreateUserRequest,
  CreateMenuRequest,
  InitializationSetupRequest,
  LoginRequest,
  ResetPasswordRequest,
  SwitchCurrentOrganizationRequest,
  UpdateOrganizationDepthConfigRequest,
  UpdateMenuApiBindingsRequest,
  UpdateMenuRequest,
  UpdateOrganizationRequest,
  UpdateOwnAvatarRequest,
  UpdateOwnPreferencesRequest,
  UpdateOwnProfileRequest,
  UpdateRoleDataPermissionsRequest,
  UpdateRoleFieldPermissionsRequest,
  UpdateRolePermissionsRequest,
  UpdateRoleRequest,
  UpdateUserPermissionOverridesRequest,
  UpdateUserRequest,
} from "@web-admin-base/contracts";

import { AuthService, type OnlineUserListFilters } from "./auth.service";
import { BusinessModuleMetadataService } from "./business-module-metadata.service";
import { InitializationService } from "./initialization.service";
import { InMemoryBackendStore } from "./in-memory-store";
import { MenuService } from "./menu.service";
import { OrganizationService } from "./organization.service";
import { PermissionExtensionService } from "./permission-extension.service";
import { ProfileService } from "./profile.service";
import {
  PermissionService,
  type ApiPermissionListFilters,
  type PermissionListFilters,
} from "./permission.service";
import { RouteMetadataService, type RouteMetadataListFilters } from "./route-metadata.service";
import { RoleService, type RoleListFilters } from "./role.service";
import {
  defaultBackendCoreConfig,
  type BackendCoreConfig,
  type BackendCoreContext,
} from "./service-context";
import { UserService, type UserListFilters } from "./user.service";
import { PermissionCache } from "../permissions/permission-cache";

export type { BackendCoreConfig } from "./service-context";

export class BackendCoreServices {
  readonly auth: AuthService;
  readonly initialization: InitializationService;
  readonly menus: MenuService;
  readonly organizations: OrganizationService;
  readonly permissions: PermissionService;
  readonly permissionExtensions: PermissionExtensionService;
  readonly profile: ProfileService;
  readonly routeMetadata: RouteMetadataService;
  readonly roles: RoleService;
  readonly users: UserService;
  private readonly businessModuleMetadata: BusinessModuleMetadataService;

  constructor(protected readonly context: BackendCoreContext) {
    this.organizations = new OrganizationService(context);
    this.menus = new MenuService(context);
    this.routeMetadata = new RouteMetadataService(context);
    this.roles = new RoleService(context);
    this.users = new UserService(context);
    this.auth = new AuthService(context);
    this.profile = new ProfileService(context, this.users);
    this.permissions = new PermissionService(context, context.permissionCache);
    this.permissionExtensions = new PermissionExtensionService(context, this.permissions);
    this.businessModuleMetadata = new BusinessModuleMetadataService(context);
    this.initialization = new InitializationService(
      context,
      this.organizations,
      this.menus,
      this.permissions,
      this.routeMetadata,
      this.roles,
      this.users,
    );
  }

  getInitializationStatus() {
    return this.initialization.getStatus();
  }

  async refreshBusinessModuleMetadata(
    definitions: import("@web-admin-base/contracts").BusinessModuleDefinition[],
  ): Promise<void> {
    this.businessModuleMetadata.synchronize(definitions);
    await this.permissions.invalidateAllPermissionContexts();
  }

  initialize(input: InitializationSetupRequest) {
    return this.initialization.setup(input);
  }

  seedInitialization(input: InitializationSetupRequest) {
    return this.initialization.seed(input);
  }

  async login(
    input: LoginRequest,
    request: { ipAddress?: string | null; userAgent?: string | null },
  ) {
    const login = await this.auth.login(input, request);
    const authContext = {
      userId: login.user.id,
      sessionId: login.session.id,
      username: login.user.username,
      currentOrganizationId: login.session.currentOrganizationId,
      tokenVersion: login.user.tokenVersion,
      passwordChangeRequired: login.user.firstLoginPasswordChangeRequired,
    };
    const permissionContext = await this.permissions.getPermissionContext(
      authContext.userId,
      authContext.currentOrganizationId,
    );
    const userContext = this.auth.getCurrentUserContext(
      authContext,
      permissionContext.permissionCodes,
    );

    return {
      ...login,
      currentOrganization: userContext.currentOrganization,
      organizations: userContext.organizations,
      permissionCodes: userContext.permissionCodes,
      menus: userContext.menus,
      passwordChangeRequired: userContext.passwordChangeRequired,
      preferences: this.profile.getPreferences(authContext.userId),
    };
  }

  refreshAccessToken(refreshToken: string) {
    return this.auth.refreshAccessToken(refreshToken);
  }

  getRefreshTokenCookiePath() {
    return this.auth.getRefreshTokenCookiePath();
  }

  getRefreshTokenCookieOptions() {
    return this.auth.getRefreshTokenCookieOptions();
  }

  async changePassword(
    authContext: NonNullable<ReturnType<AuthService["findAuthContext"]>>,
    input: ChangePasswordRequest,
  ) {
    const user = await this.auth.changePassword(authContext, input);
    await this.permissions.invalidateUser(authContext.userId);
    return user;
  }

  async switchCurrentOrganization(
    authContext: NonNullable<ReturnType<AuthService["findAuthContext"]>>,
    input: SwitchCurrentOrganizationRequest,
  ) {
    const permissionContext = await this.permissions.getPermissionContext(
      authContext.userId,
      input.organizationId,
    );
    return this.auth.switchCurrentOrganization(
      authContext,
      input,
      permissionContext.permissionCodes,
    );
  }

  async getCurrentUserContext(
    authContext: NonNullable<ReturnType<AuthService["findAuthContext"]>>,
  ) {
    const permissionContext = await this.permissions.getPermissionContext(
      authContext.userId,
      authContext.currentOrganizationId,
    );
    return {
      ...this.auth.getCurrentUserContext(authContext, permissionContext.permissionCodes),
      preferences: this.profile.getPreferences(authContext.userId),
    };
  }

  getProfile(authContext: NonNullable<ReturnType<AuthService["findAuthContext"]>>) {
    return this.profile.getProfile(authContext);
  }

  async updateOwnProfile(
    authContext: NonNullable<ReturnType<AuthService["findAuthContext"]>>,
    input: UpdateOwnProfileRequest,
  ) {
    const profile = this.profile.updateProfile(authContext, input);
    await this.permissions.invalidateUser(authContext.userId);
    return profile;
  }

  async updateOwnPreferences(
    authContext: NonNullable<ReturnType<AuthService["findAuthContext"]>>,
    input: UpdateOwnPreferencesRequest,
  ) {
    return this.profile.updatePreferences(authContext, input);
  }

  async updateOwnAvatar(
    authContext: NonNullable<ReturnType<AuthService["findAuthContext"]>>,
    input: UpdateOwnAvatarRequest,
  ) {
    const profile = this.profile.updateAvatar(authContext, input);
    await this.permissions.invalidateUser(authContext.userId);
    return profile;
  }

  listCurrentUserOrganizations(
    authContext: NonNullable<ReturnType<AuthService["findAuthContext"]>>,
  ) {
    return this.auth.listCurrentUserOrganizations(authContext);
  }

  async getCurrentPermissionContext(
    authContext: NonNullable<ReturnType<AuthService["findAuthContext"]>>,
  ) {
    const permissionContext = await this.permissions.getPermissionContext(
      authContext.userId,
      authContext.currentOrganizationId,
    );
    return {
      ...this.auth.getCurrentPermissionContext(authContext, permissionContext.permissionCodes),
      dataPermissions: permissionContext.dataPermissions ?? [],
      fieldPermissions: permissionContext.fieldPermissions ?? [],
      userPermissionOverrides: permissionContext.userPermissionOverrides ?? [],
    };
  }

  findAuthContext(authorizationHeader?: string | null) {
    return this.auth.findAuthContext(authorizationHeader);
  }

  requireApiPermission(
    authContext: ReturnType<AuthService["findAuthContext"]>,
    apiPermission: BaseApiPermissionManifestEntry,
  ) {
    return this.permissions.requireApiPermission(authContext, apiPermission);
  }

  logout(sessionId: string) {
    return this.auth.logout(sessionId);
  }

  listOnlineUsers(filters: OnlineUserListFilters = {}) {
    return this.auth.listOnlineUsers(filters);
  }

  listOrganizations() {
    return this.organizations.list();
  }

  listOrganizationTree() {
    return this.organizations.listTree();
  }

  getOrganizationDepthConfig() {
    return this.organizations.getDepthConfig();
  }

  updateOrganizationDepthConfig(input: UpdateOrganizationDepthConfigRequest) {
    return this.organizations.updateDepthConfig(input);
  }

  getOrganization(id: string) {
    return this.organizations.get(id);
  }

  async createOrganization(input: CreateOrganizationRequest, actorId: string | null = null) {
    const organization = this.organizations.create(input, actorId);
    await this.permissions.invalidateAllPermissionContexts();
    return organization;
  }

  async updateOrganization(
    id: string,
    input: UpdateOrganizationRequest,
    actorId: string | null = null,
  ) {
    const organization = this.organizations.update(id, input, actorId);
    await this.permissions.invalidateAllPermissionContexts();
    return organization;
  }

  async disableOrganization(id: string, actorId: string | null = null) {
    const organizations = this.organizations.disable(id, actorId);
    await this.permissions.invalidateAllPermissionContexts();
    return organizations;
  }

  async enableOrganization(id: string, actorId: string | null = null) {
    const organization = this.organizations.enable(id, actorId);
    await this.permissions.invalidateAllPermissionContexts();
    return organization;
  }

  async deleteOrganization(id: string, deletedBy: string | null = null) {
    const organization = this.organizations.delete(id, deletedBy);
    await this.permissions.invalidateAllPermissionContexts();
    return organization;
  }

  listUsers(filters: UserListFilters = {}) {
    return this.users.list(filters);
  }

  getUser(id: string) {
    return this.users.get(id);
  }

  createUser(input: CreateUserRequest, actorId: string | null = null) {
    return this.users.create(input, actorId);
  }

  async updateUser(id: string, input: UpdateUserRequest, actorId: string | null = null) {
    const user = this.users.update(id, input, actorId);
    await this.permissions.invalidateUser(id);
    return user;
  }

  async setUserStatus(
    id: string,
    status: "enabled" | "disabled" | "locked",
    actorId: string | null = null,
  ) {
    const user = this.users.setStatus(id, status, actorId);
    await this.permissions.invalidateUser(id);
    return user;
  }

  async resetUserPassword(id: string, input: ResetPasswordRequest, actorId: string | null = null) {
    const user = await this.users.resetPassword(id, input, actorId);
    await this.permissions.invalidateUser(id);
    return user;
  }

  async deleteUser(id: string, deletedBy: string | null = null) {
    const user = this.users.delete(id, deletedBy);
    await this.permissions.invalidateUser(id);
    return user;
  }

  async assignUserOrganizationRole(
    userId: string,
    input: AssignUserOrganizationRoleRequest,
    actorId: string | null = null,
  ) {
    const binding = this.users.assignOrganizationRole(userId, input, actorId);
    await this.permissions.invalidateUser(userId);
    return binding;
  }

  listUserOrganizationRoles(userId: string) {
    return this.users.listOrganizationRoles(userId);
  }

  async removeUserOrganizationRole(
    userId: string,
    organizationId: string,
    deletedBy: string | null = null,
  ) {
    const result = this.users.removeOrganizationRole(userId, organizationId, deletedBy);
    await this.permissions.invalidateUser(userId);
    return result;
  }

  listRoles(filters: RoleListFilters = {}) {
    return this.roles.list(filters);
  }

  getRole(id: string) {
    return this.roles.get(id);
  }

  createRole(input: CreateRoleRequest, actorId: string | null = null) {
    return this.roles.create(input, actorId);
  }

  async updateRole(id: string, input: UpdateRoleRequest, actorId: string | null = null) {
    const role = this.roles.update(id, input, actorId);
    await this.permissions.invalidateRole(id);
    return role;
  }

  async setRoleStatus(id: string, status: "enabled" | "disabled", actorId: string | null = null) {
    const role = this.roles.setStatus(id, status, actorId);
    await this.permissions.invalidateRole(id);
    return role;
  }

  copyRole(id: string, actorId: string | null = null) {
    return this.roles.copy(id, actorId);
  }

  async updateRolePermissions(
    id: string,
    input: UpdateRolePermissionsRequest,
    actorId: string | null = null,
  ) {
    const role = this.roles.updatePermissions(id, input, actorId);
    await this.permissions.invalidateRole(id);
    return role;
  }

  listRolePermissionCodes(id: string) {
    return this.roles.listPermissionCodes(id);
  }

  listRoleDataPermissions(id: string) {
    return this.permissionExtensions.listRoleDataPermissions(id);
  }

  updateRoleDataPermissions(
    id: string,
    input: UpdateRoleDataPermissionsRequest,
    actorId: string | null = null,
  ) {
    return this.permissionExtensions.updateRoleDataPermissions(id, input, actorId);
  }

  listRoleFieldPermissions(id: string) {
    return this.permissionExtensions.listRoleFieldPermissions(id);
  }

  updateRoleFieldPermissions(
    id: string,
    input: UpdateRoleFieldPermissionsRequest,
    actorId: string | null = null,
  ) {
    return this.permissionExtensions.updateRoleFieldPermissions(id, input, actorId);
  }

  listUserPermissionOverrides(userId: string) {
    return this.permissionExtensions.listUserPermissionOverrides(userId);
  }

  updateUserPermissionOverrides(
    userId: string,
    input: UpdateUserPermissionOverridesRequest,
    actorId: string | null = null,
  ) {
    return this.permissionExtensions.updateUserPermissionOverrides(userId, input, actorId);
  }

  async deleteRole(id: string, deletedBy: string | null = null) {
    const role = this.roles.delete(id, deletedBy);
    await this.permissions.invalidateRole(id);
    return role;
  }

  listPermissions(filters: PermissionListFilters = {}) {
    return this.permissions.listPermissions(filters);
  }

  listPermissionTree() {
    return this.permissions.listPermissionTree();
  }

  listApiPermissions(filters: ApiPermissionListFilters = {}) {
    return this.permissions.listApiPermissions(filters);
  }

  syncPermissions() {
    return this.permissions.syncPermissionManifests();
  }

  async synchronizeBaseManifests() {
    const permissionMetadata = await this.syncPermissions();
    const routes = await this.syncRoutes();
    const menus = this.menus.seedBaseMenus(baseMenuManifest);
    return { ...permissionMetadata, routes, menus };
  }

  listRoutes(filters: RouteMetadataListFilters = {}) {
    return this.routeMetadata.list(filters);
  }

  async syncRoutes() {
    const routes = this.routeMetadata.syncBaseRoutes(baseRouteManifest);
    await this.permissions.invalidateAllPermissionContexts();
    return routes;
  }

  listMenus() {
    return this.menus.list();
  }

  listMenuTree() {
    return this.menus.listTree();
  }

  async createMenu(input: CreateMenuRequest) {
    const menu = this.menus.create(input);
    await this.permissions.invalidateAllPermissionContexts();
    return menu;
  }

  async updateMenu(id: string, input: UpdateMenuRequest) {
    const menu = this.menus.update(id, input);
    await this.permissions.invalidateAllPermissionContexts();
    return menu;
  }

  async deleteMenu(id: string, deletedBy: string | null = null) {
    const menu = this.menus.delete(id, deletedBy);
    await this.permissions.invalidateAllPermissionContexts();
    return menu;
  }

  async updateMenuApiBindings(id: string, input: UpdateMenuApiBindingsRequest) {
    const bindings = this.menus.updateApiBindings(id, input);
    await this.permissions.invalidateAllPermissionContexts();
    return bindings;
  }
}

export function createInMemoryBackendCoreServices(config?: Partial<BackendCoreConfig>) {
  return new BackendCoreServices({
    store: new InMemoryBackendStore(),
    permissionCache: new PermissionCache(createInMemoryCacheAdapter()),
    tokenStore: createInMemoryTokenStoreAdapter(),
    config: {
      ...defaultBackendCoreConfig,
      ...config,
    },
  });
}
