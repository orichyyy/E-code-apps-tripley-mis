import {
  baseMenuManifest,
  baseRouteManifest,
  type InitializationSetupRequest
} from "@web-admin-base/contracts";

import { createKnownError } from "../../core/errors/error-codes";
import { nowUtc, toUtcIso } from "../../core/time/utc";
import {
  validatePasswordComplexity
} from "../../infra/security/password-policy";
import type { BackendCoreContext } from "./service-context";
import type { MenuService } from "./menu.service";
import type { OrganizationService } from "./organization.service";
import type { PermissionService } from "./permission.service";
import type { RouteMetadataService } from "./route-metadata.service";
import type { RoleService } from "./role.service";
import type { UserService } from "./user.service";
import { toPublicOrganization, toPublicUser } from "./serializers";
import { builtInRoleCodes } from "./built-in-roles";

export class InitializationService {
  constructor(
    private readonly context: BackendCoreContext,
    private readonly organizations: OrganizationService,
    private readonly menus: MenuService,
    private readonly permissions: PermissionService,
    private readonly routes: RouteMetadataService,
    private readonly roles: RoleService,
    private readonly users: UserService
  ) {}

  getStatus() {
    return {
      initialized: this.context.store.initializationState?.status === "initialized",
      state: this.context.store.initializationState
    };
  }

  async setup(input: InitializationSetupRequest) {
    if (this.context.store.initializationState?.status === "initialized") {
      throw createKnownError("BUSINESS_SYSTEM_ALREADY_INITIALIZED");
    }

    return this.initializeFreshSystem(input, "Default root organization");
  }

  async seed(input: InitializationSetupRequest) {
    if (this.context.store.initializationState?.status !== "initialized") {
      const initialized = await this.initializeFreshSystem(
        input,
        "Seeded default root organization"
      );
      return { ...initialized, seeded: true };
    }

    const permissions = this.permissions.syncBasePermissions();
    const apiPermissions = this.permissions.syncBaseApiPermissions();
    const superAdminRole = this.ensureBuiltInRole("Super Administrator", builtInRoleCodes.superAdmin);
    this.grantAllPermissions(superAdminRole.id, permissions.map((permission) => permission.code));
    this.ensureBuiltInRole("Organization Administrator", builtInRoleCodes.organizationAdmin);
    this.ensureBuiltInRole("Normal User", builtInRoleCodes.normalUser);
    const menus = this.menus.seedBaseMenus(baseMenuManifest);
    const routes = this.routes.syncBaseRoutes(baseRouteManifest);
    const initializedBy = this.context.store.initializationState.initializedBy;
    const admin = initializedBy ? this.context.store.users.get(initializedBy) : undefined;

    return {
      state: this.context.store.initializationState,
      organization: null,
      admin: admin ? toPublicUser(admin) : null,
      roles: this.roles.list(),
      permissions,
      apiPermissions,
      menus,
      routes,
      seeded: false
    };
  }

  private async initializeFreshSystem(input: InitializationSetupRequest, organizationRemark: string) {
    const passwordResult = validatePasswordComplexity(
      input.adminPassword,
      this.context.config.passwordPolicy
    );
    if (!passwordResult.valid) {
      throw createKnownError((passwordResult.reasons[0] ?? "VALIDATION_PASSWORD_POLICY") as never);
    }

    const organization = this.organizations.createRecord({
      name: input.organizationName,
      code: input.organizationCode,
      sortOrder: 0,
      remark: organizationRemark
    });
    const superAdminRole = this.roles.createRecord({
      name: "Super Administrator",
      code: builtInRoleCodes.superAdmin,
      description: "Built-in role",
      remark: "Built-in role"
    }, null, { isBuiltin: true });
    const permissions = this.permissions.syncBasePermissions();
    const apiPermissions = this.permissions.syncBaseApiPermissions();
    this.grantAllPermissions(superAdminRole.id, permissions.map((permission) => permission.code));
    this.roles.createRecord({
      name: "Organization Administrator",
      code: builtInRoleCodes.organizationAdmin,
      description: "Built-in role",
      remark: "Built-in role"
    }, null, { isBuiltin: true });
    this.roles.createRecord({
      name: "Normal User",
      code: builtInRoleCodes.normalUser,
      description: "Built-in role",
      remark: "Built-in role"
    }, null, { isBuiltin: true });
    const menus = this.menus.seedBaseMenus(baseMenuManifest);
    const routes = this.routes.syncBaseRoutes(baseRouteManifest);

    const admin = await this.users.createRecord({
      username: input.adminUsername,
      displayName: input.adminDisplayName,
      email: input.adminEmail,
      phone: input.adminPhone,
      password: input.adminPassword,
      primaryOrganizationId: organization.id,
      roleId: superAdminRole.id
    });
    admin.firstLoginPasswordChangeRequired = false;
    admin.updatedAt = toUtcIso(nowUtc());

    const now = toUtcIso(nowUtc());
    this.context.store.initializationState = {
      id: this.context.store.nextId("initializationState"),
      tenantId: null,
      status: "initialized",
      initializedAt: now,
      initializedBy: admin.id,
      version: "0.1.0",
      createdAt: now,
      updatedAt: now
    };

    return {
      state: this.context.store.initializationState,
      organization: toPublicOrganization(organization),
      admin: toPublicUser(admin),
      roles: this.roles.list(),
      permissions,
      apiPermissions,
      menus,
      routes
    };
  }

  private ensureBuiltInRole(name: string, code: string) {
    const existing = this.roles.list().find((role) => role.code === code);
    if (existing) return existing;
    return this.roles.createRecord({
      name,
      code,
      description: "Built-in role",
      remark: "Built-in role"
    }, null, { isBuiltin: true });
  }

  private grantAllPermissions(roleId: string, permissionCodes: string[]) {
    const now = toUtcIso(nowUtc());
    const existing = new Set(
      this.context.store.rolePermissions
        .filter((permission) => permission.roleId === roleId)
        .map((permission) => permission.permissionCode)
    );
    permissionCodes.forEach((permissionCode) => {
      if (existing.has(permissionCode)) return;
      this.context.store.rolePermissions.push({
        roleId,
        permissionCode,
        effect: "allow",
        createdAt: now,
        updatedAt: now
      });
      existing.add(permissionCode);
    });
  }
}
