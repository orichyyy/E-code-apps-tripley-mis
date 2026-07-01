import {
  baseMenuManifest,
  basePermissionManifest,
  type InitializationSetupRequest
} from "@web-admin-base/contracts";

import { createKnownError } from "../../core/errors/error-codes";
import { nowUtc, toUtcIso } from "../../core/time/utc";
import {
  validatePasswordComplexity
} from "../../infra/security/password-policy";
import type { BackendCoreContext } from "./service-context";
import type { OrganizationService } from "./organization.service";
import type { RoleService } from "./role.service";
import type { UserService } from "./user.service";
import { toPublicOrganization, toPublicUser } from "./serializers";

const superAdminRoleCode = "super_admin";
const orgAdminRoleCode = "organization_admin";
const normalUserRoleCode = "normal_user";

export class InitializationService {
  constructor(
    private readonly context: BackendCoreContext,
    private readonly organizations: OrganizationService,
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

    const passwordResult = validatePasswordComplexity(input.adminPassword);
    if (!passwordResult.valid) {
      throw createKnownError((passwordResult.reasons[0] ?? "VALIDATION_PASSWORD_POLICY") as never);
    }

    const organization = this.organizations.createRecord({
      name: input.organizationName,
      code: input.organizationCode,
      sortOrder: 0,
      remark: "Default root organization"
    });
    const superAdminRole = this.roles.createRecord({
      name: "Super Administrator",
      code: superAdminRoleCode,
      remark: "Built-in role"
    });
    this.context.store.rolePermissions.push(
      ...basePermissionManifest.map((permission) => ({
        roleId: superAdminRole.id,
        permissionCode: permission.code,
        createdAt: toUtcIso(nowUtc())
      }))
    );
    this.roles.createRecord({
      name: "Organization Administrator",
      code: orgAdminRoleCode,
      remark: "Built-in role"
    });
    this.roles.createRecord({
      name: "Normal User",
      code: normalUserRoleCode,
      remark: "Built-in role"
    });

    const admin = await this.users.createRecord({
      username: input.adminUsername,
      displayName: input.adminDisplayName,
      email: input.adminEmail,
      phone: input.adminPhone,
      password: input.adminPassword,
      primaryOrganizationId: organization.id,
      roleId: superAdminRole.id
    });

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
      menus: baseMenuManifest
    };
  }
}
