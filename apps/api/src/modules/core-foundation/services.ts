import {
  createInMemoryCacheAdapter,
  createInMemoryTokenStoreAdapter
} from "@web-admin-base/adapters";
import {
  baseRouteManifest,
  type BaseApiPermissionManifestEntry
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
  UpdateMenuRequest,
  UpdateOrganizationRequest,
  UpdateRolePermissionsRequest,
  UpdateRoleRequest,
  UpdateUserRequest
} from "@web-admin-base/contracts";

import { AuthService } from "./auth.service";
import { InitializationService } from "./initialization.service";
import { InMemoryBackendStore } from "./in-memory-store";
import { MenuService } from "./menu.service";
import { OrganizationService } from "./organization.service";
import { PermissionService } from "./permission.service";
import { RouteMetadataService } from "./route-metadata.service";
import { RoleService } from "./role.service";
import {
  defaultBackendCoreConfig,
  type BackendCoreConfig,
  type BackendCoreContext
} from "./service-context";
import { UserService } from "./user.service";
import { PermissionCache } from "../permissions/permission-cache";

export type { BackendCoreConfig } from "./service-context";

export class BackendCoreServices {
  readonly auth: AuthService;
  readonly initialization: InitializationService;
  readonly menus: MenuService;
  readonly organizations: OrganizationService;
  readonly permissions: PermissionService;
  readonly routeMetadata: RouteMetadataService;
  readonly roles: RoleService;
  readonly users: UserService;

  constructor(private readonly context: BackendCoreContext) {
    this.organizations = new OrganizationService(context);
    this.menus = new MenuService(context);
    this.routeMetadata = new RouteMetadataService(context);
    this.roles = new RoleService(context);
    this.users = new UserService(context);
    this.auth = new AuthService(context);
    this.permissions = new PermissionService(context, context.permissionCache);
    this.initialization = new InitializationService(
      context,
      this.organizations,
      this.menus,
      this.permissions,
      this.routeMetadata,
      this.roles,
      this.users
    );
  }

  getInitializationStatus() {
    return this.initialization.getStatus();
  }

  initialize(input: InitializationSetupRequest) {
    return this.initialization.setup(input);
  }

  seedInitialization(input: InitializationSetupRequest) {
    return this.initialization.seed(input);
  }

  async login(input: LoginRequest, request: { ipAddress?: string | null; userAgent?: string | null }) {
    const login = await this.auth.login(input, request);
    const authContext = {
      userId: login.user.id,
      sessionId: login.session.id,
      username: login.user.username,
      currentOrganizationId: login.session.currentOrganizationId,
      tokenVersion: login.user.tokenVersion,
      passwordChangeRequired: login.user.firstLoginPasswordChangeRequired
    };
    const permissionContext = await this.permissions.getPermissionContext(
      authContext.userId,
      authContext.currentOrganizationId
    );
    const userContext = this.auth.getCurrentUserContext(
      authContext,
      permissionContext.permissionCodes
    );

    return {
      ...login,
      currentOrganization: userContext.currentOrganization,
      organizations: userContext.organizations,
      permissionCodes: userContext.permissionCodes,
      menus: userContext.menus,
      passwordChangeRequired: userContext.passwordChangeRequired
    };
  }

  refreshAccessToken(refreshToken: string) {
    return this.auth.refreshAccessToken(refreshToken);
  }

  changePassword(authContext: NonNullable<ReturnType<AuthService["findAuthContext"]>>, input: ChangePasswordRequest) {
    return this.auth.changePassword(authContext, input);
  }

  async switchCurrentOrganization(
    authContext: NonNullable<ReturnType<AuthService["findAuthContext"]>>,
    input: SwitchCurrentOrganizationRequest
  ) {
    const permissionContext = await this.permissions.getPermissionContext(
      authContext.userId,
      input.organizationId
    );
    return this.auth.switchCurrentOrganization(
      authContext,
      input,
      permissionContext.permissionCodes
    );
  }

  async getCurrentUserContext(authContext: NonNullable<ReturnType<AuthService["findAuthContext"]>>) {
    const permissionContext = await this.permissions.getPermissionContext(
      authContext.userId,
      authContext.currentOrganizationId
    );
    return this.auth.getCurrentUserContext(authContext, permissionContext.permissionCodes);
  }

  listCurrentUserOrganizations(authContext: NonNullable<ReturnType<AuthService["findAuthContext"]>>) {
    return this.auth.listCurrentUserOrganizations(authContext);
  }

  async getCurrentPermissionContext(
    authContext: NonNullable<ReturnType<AuthService["findAuthContext"]>>
  ) {
    const permissionContext = await this.permissions.getPermissionContext(
      authContext.userId,
      authContext.currentOrganizationId
    );
    return this.auth.getCurrentPermissionContext(authContext, permissionContext.permissionCodes);
  }

  findAuthContext(authorizationHeader?: string | null) {
    return this.auth.findAuthContext(authorizationHeader);
  }

  requireApiPermission(
    authContext: ReturnType<AuthService["findAuthContext"]>,
    apiPermission: BaseApiPermissionManifestEntry
  ) {
    return this.permissions.requireApiPermission(authContext, apiPermission);
  }

  logout(sessionId: string) {
    return this.auth.logout(sessionId);
  }

  listOnlineUsers() {
    return this.auth.listOnlineUsers();
  }

  listOrganizations() {
    return this.organizations.list();
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
    actorId: string | null = null
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

  listUsers() {
    return this.users.list();
  }

  getUser(id: string) {
    return this.users.get(id);
  }

  createUser(input: CreateUserRequest, actorId: string | null = null) {
    return this.users.create(input, actorId);
  }

  updateUser(id: string, input: UpdateUserRequest, actorId: string | null = null) {
    return this.users.update(id, input, actorId);
  }

  async setUserStatus(
    id: string,
    status: "enabled" | "disabled" | "locked",
    actorId: string | null = null
  ) {
    const user = this.users.setStatus(id, status, actorId);
    await this.permissions.invalidateUser(id);
    return user;
  }

  resetUserPassword(
    id: string,
    input: ResetPasswordRequest,
    actorId: string | null = null
  ) {
    return this.users.resetPassword(id, input, actorId);
  }

  async deleteUser(id: string, deletedBy: string | null = null) {
    const user = this.users.delete(id, deletedBy);
    await this.permissions.invalidateUser(id);
    return user;
  }

  async assignUserOrganizationRole(
    userId: string,
    input: AssignUserOrganizationRoleRequest,
    actorId: string | null = null
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
    deletedBy: string | null = null
  ) {
    const result = this.users.removeOrganizationRole(userId, organizationId, deletedBy);
    await this.permissions.invalidateUser(userId);
    return result;
  }

  listRoles() {
    return this.roles.list();
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

  async setRoleStatus(
    id: string,
    status: "enabled" | "disabled",
    actorId: string | null = null
  ) {
    const role = this.roles.setStatus(id, status, actorId);
    await this.permissions.invalidateRole(id);
    return role;
  }

  copyRole(id: string, actorId: string | null = null) {
    return this.roles.copy(id, actorId);
  }

  async updateRolePermissions(id: string, input: UpdateRolePermissionsRequest) {
    const role = this.roles.updatePermissions(id, input);
    await this.permissions.invalidateRole(id);
    return role;
  }

  listRolePermissionCodes(id: string) {
    return this.roles.listPermissionCodes(id);
  }

  async deleteRole(id: string, deletedBy: string | null = null) {
    const role = this.roles.delete(id, deletedBy);
    await this.permissions.invalidateRole(id);
    return role;
  }

  listPermissions() {
    return this.permissions.listPermissions();
  }

  listApiPermissions() {
    return this.permissions.listApiPermissions();
  }

  syncPermissions() {
    return this.permissions.syncPermissionManifests();
  }

  listRoutes() {
    return this.routeMetadata.list();
  }

  async syncRoutes() {
    const routes = this.routeMetadata.syncBaseRoutes(baseRouteManifest);
    await this.permissions.invalidateAllPermissionContexts();
    return routes;
  }

  listMenus() {
    return this.menus.list();
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
}

export function createInMemoryBackendCoreServices(config?: Partial<BackendCoreConfig>) {
  return new BackendCoreServices({
    store: new InMemoryBackendStore(),
    permissionCache: new PermissionCache(createInMemoryCacheAdapter()),
    tokenStore: createInMemoryTokenStoreAdapter(),
    config: {
      ...defaultBackendCoreConfig,
      ...config
    }
  });
}
