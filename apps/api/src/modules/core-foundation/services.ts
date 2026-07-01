import { baseMenuManifest, basePermissionManifest, baseRouteManifest } from "@web-admin-base/contracts";
import type {
  AssignUserOrganizationRoleRequest,
  CreateOrganizationRequest,
  CreateRoleRequest,
  CreateUserRequest,
  InitializationSetupRequest,
  LoginRequest,
  ResetPasswordRequest,
  UpdateOrganizationRequest,
  UpdateRolePermissionsRequest,
  UpdateRoleRequest,
  UpdateUserRequest
} from "@web-admin-base/contracts";

import { AuthService } from "./auth.service";
import { InitializationService } from "./initialization.service";
import { InMemoryBackendStore } from "./in-memory-store";
import { OrganizationService } from "./organization.service";
import { RoleService } from "./role.service";
import {
  defaultBackendCoreConfig,
  type BackendCoreConfig,
  type BackendCoreContext
} from "./service-context";
import { UserService } from "./user.service";

export type { BackendCoreConfig } from "./service-context";

export class BackendCoreServices {
  readonly auth: AuthService;
  readonly initialization: InitializationService;
  readonly organizations: OrganizationService;
  readonly roles: RoleService;
  readonly users: UserService;

  constructor(private readonly context: BackendCoreContext) {
    this.organizations = new OrganizationService(context);
    this.roles = new RoleService(context);
    this.users = new UserService(context);
    this.auth = new AuthService(context);
    this.initialization = new InitializationService(
      context,
      this.organizations,
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

  logout(sessionId: string) {
    return this.auth.logout(sessionId);
  }

  listOnlineUsers() {
    return this.auth.listOnlineUsers();
  }

  listOrganizations() {
    return this.organizations.list();
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

  assignUserOrganizationRole(userId: string, input: AssignUserOrganizationRoleRequest) {
    return this.users.assignOrganizationRole(userId, input);
  }

  removeUserOrganizationRole(userId: string, organizationId: string) {
    return this.users.removeOrganizationRole(userId, organizationId);
  }

  listRoles() {
    return this.roles.list();
  }

  createRole(input: CreateRoleRequest) {
    return this.roles.create(input);
  }

  updateRole(id: string, input: UpdateRoleRequest) {
    return this.roles.update(id, input);
  }

  copyRole(id: string) {
    return this.roles.copy(id);
  }

  updateRolePermissions(id: string, input: UpdateRolePermissionsRequest) {
    return this.roles.updatePermissions(id, input);
  }

  deleteRole(id: string) {
    return this.roles.delete(id);
  }

  listPermissions() {
    return basePermissionManifest;
  }

  listRoutes() {
    return baseRouteManifest;
  }

  listMenus() {
    return baseMenuManifest;
  }
}

export function createInMemoryBackendCoreServices(config?: Partial<BackendCoreConfig>) {
  return new BackendCoreServices({
    store: new InMemoryBackendStore(),
    config: {
      ...defaultBackendCoreConfig,
      ...config
    }
  });
}
