import {
  createInMemoryCacheAdapter,
  createInMemoryTokenStoreAdapter
} from "@web-admin-base/adapters";
import {
  basePermissionManifest,
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
  readonly roles: RoleService;
  readonly users: UserService;

  constructor(private readonly context: BackendCoreContext) {
    this.organizations = new OrganizationService(context);
    this.menus = new MenuService(context);
    this.roles = new RoleService(context);
    this.users = new UserService(context);
    this.auth = new AuthService(context);
    this.permissions = new PermissionService(context, context.permissionCache);
    this.initialization = new InitializationService(
      context,
      this.organizations,
      this.menus,
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

  login(input: LoginRequest, request: { ipAddress?: string | null; userAgent?: string | null }) {
    return this.auth.login(input, request);
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

  getOrganization(id: string) {
    return this.organizations.get(id);
  }

  createOrganization(input: CreateOrganizationRequest) {
    return this.organizations.create(input);
  }

  updateOrganization(id: string, input: UpdateOrganizationRequest) {
    return this.organizations.update(id, input);
  }

  disableOrganization(id: string) {
    return this.organizations.disable(id);
  }

  enableOrganization(id: string) {
    return this.organizations.enable(id);
  }

  deleteOrganization(id: string) {
    return this.organizations.delete(id);
  }

  listUsers() {
    return this.users.list();
  }

  getUser(id: string) {
    return this.users.get(id);
  }

  createUser(input: CreateUserRequest) {
    return this.users.create(input);
  }

  updateUser(id: string, input: UpdateUserRequest) {
    return this.users.update(id, input);
  }

  setUserStatus(id: string, status: "enabled" | "disabled" | "locked") {
    return this.users.setStatus(id, status);
  }

  resetUserPassword(id: string, input: ResetPasswordRequest) {
    return this.users.resetPassword(id, input);
  }

  deleteUser(id: string) {
    return this.users.delete(id);
  }

  async assignUserOrganizationRole(userId: string, input: AssignUserOrganizationRoleRequest) {
    const binding = this.users.assignOrganizationRole(userId, input);
    await this.permissions.invalidateUserOrganization(userId, input.organizationId);
    return binding;
  }

  listUserOrganizationRoles(userId: string) {
    return this.users.listOrganizationRoles(userId);
  }

  async removeUserOrganizationRole(userId: string, organizationId: string) {
    const result = this.users.removeOrganizationRole(userId, organizationId);
    await this.permissions.invalidateUserOrganization(userId, organizationId);
    return result;
  }

  listRoles() {
    return this.roles.list();
  }

  getRole(id: string) {
    return this.roles.get(id);
  }

  createRole(input: CreateRoleRequest) {
    return this.roles.create(input);
  }

  async updateRole(id: string, input: UpdateRoleRequest) {
    const role = this.roles.update(id, input);
    await this.permissions.invalidateRole(id);
    return role;
  }

  copyRole(id: string) {
    return this.roles.copy(id);
  }

  async updateRolePermissions(id: string, input: UpdateRolePermissionsRequest) {
    const role = this.roles.updatePermissions(id, input);
    await this.permissions.invalidateRole(id);
    return role;
  }

  listRolePermissionCodes(id: string) {
    return this.roles.listPermissionCodes(id);
  }

  async deleteRole(id: string) {
    const role = this.roles.delete(id);
    await this.permissions.invalidateRole(id);
    return role;
  }

  listPermissions() {
    return basePermissionManifest;
  }

  listRoutes() {
    return baseRouteManifest;
  }

  listMenus() {
    return this.menus.list();
  }

  createMenu(input: CreateMenuRequest) {
    return this.menus.create(input);
  }

  updateMenu(id: string, input: UpdateMenuRequest) {
    return this.menus.update(id, input);
  }

  deleteMenu(id: string) {
    return this.menus.delete(id);
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
