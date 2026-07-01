import type {
  AssignUserOrganizationRoleRequest,
  CreateUserRequest,
  ResetPasswordRequest,
  UpdateUserRequest
} from "@web-admin-base/contracts";

import { createKnownError, type KnownErrorCode } from "../../core/errors/error-codes";
import { addDaysUtc, nowUtc, toUtcIso } from "../../core/time/utc";
import { hashPassword } from "../../infra/security/password-hash";
import {
  validatePasswordComplexity
} from "../../infra/security/password-policy";
import type { PublicUser, UserOrganizationRoleRecord, UserRecord } from "./domain";
import type { BackendCoreContext } from "./service-context";
import {
  requireEnabledOrganization,
  requireEnabledRole,
  requireUser
} from "./store-guards";
import { toPublicUser } from "./serializers";

export class UserService {
  constructor(private readonly context: BackendCoreContext) {}

  list(): PublicUser[] {
    return [...this.context.store.users.values()].filter((user) => !user.isDeleted).map(toPublicUser);
  }

  async create(input: CreateUserRequest): Promise<PublicUser> {
    return toPublicUser(await this.createRecord(input));
  }

  async createRecord(input: CreateUserRequest): Promise<UserRecord> {
    requireEnabledOrganization(this.context.store, input.primaryOrganizationId);
    requireEnabledRole(this.context.store, input.roleId);
    this.ensureUniqueUser(input.username, input.email, input.phone);
    const passwordResult = validatePasswordComplexity(input.password, this.context.config.passwordPolicy);
    if (!passwordResult.valid) {
      throw createKnownError((passwordResult.reasons[0] ?? "VALIDATION_PASSWORD_POLICY") as KnownErrorCode);
    }

    const now = nowUtc();
    const user: UserRecord = {
      id: this.context.store.nextId("user"),
      tenantId: null,
      username: input.username,
      displayName: input.displayName,
      email: input.email,
      phone: input.phone,
      passwordHash: await hashPassword(input.password),
      primaryOrganizationId: input.primaryOrganizationId,
      status: "enabled",
      firstLoginPasswordChangeRequired: true,
      passwordChangedAt: toUtcIso(now),
      passwordExpiresAt: toUtcIso(addDaysUtc(now, this.context.config.passwordPolicy.periodicChangeDays)),
      failedLoginAttempts: 0,
      lockedUntil: null,
      tokenVersion: 0,
      lastLoginAt: null,
      remark: null,
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
      createdAt: toUtcIso(now),
      updatedAt: toUtcIso(now)
    };
    this.context.store.users.set(user.id, user);
    this.bindToOrganization(user.id, input.primaryOrganizationId, input.roleId);
    return user;
  }

  update(id: string, input: UpdateUserRequest): PublicUser {
    const user = requireUser(this.context.store, id);
    if (input.username !== undefined) user.username = input.username;
    if (input.displayName !== undefined) user.displayName = input.displayName;
    if (input.email !== undefined) user.email = input.email;
    if (input.phone !== undefined) user.phone = input.phone;
    if (input.primaryOrganizationId !== undefined) user.primaryOrganizationId = input.primaryOrganizationId;
    if (input.remark !== undefined) user.remark = input.remark;
    user.updatedAt = toUtcIso(nowUtc());
    return toPublicUser(user);
  }

  setStatus(id: string, status: "enabled" | "disabled" | "locked"): PublicUser {
    const user = requireUser(this.context.store, id);
    user.status = status;
    user.updatedAt = toUtcIso(nowUtc());
    return toPublicUser(user);
  }

  async resetPassword(id: string, input: ResetPasswordRequest): Promise<PublicUser> {
    const result = validatePasswordComplexity(input.password, this.context.config.passwordPolicy);
    if (!result.valid) {
      throw createKnownError((result.reasons[0] ?? "VALIDATION_PASSWORD_POLICY") as KnownErrorCode);
    }

    const user = requireUser(this.context.store, id);
    const now = nowUtc();
    user.passwordHash = await hashPassword(input.password);
    user.passwordChangedAt = toUtcIso(now);
    user.passwordExpiresAt = toUtcIso(addDaysUtc(now, this.context.config.passwordPolicy.periodicChangeDays));
    user.firstLoginPasswordChangeRequired = true;
    user.tokenVersion += 1;
    user.updatedAt = toUtcIso(now);
    return toPublicUser(user);
  }

  delete(id: string, deletedBy: string | null = null): PublicUser {
    const user = requireUser(this.context.store, id);
    const now = toUtcIso(nowUtc());
    user.isDeleted = true;
    user.deletedAt = now;
    user.deletedBy = deletedBy;
    user.updatedAt = now;
    return toPublicUser(user);
  }

  assignOrganizationRole(
    userId: string,
    input: AssignUserOrganizationRoleRequest
  ): UserOrganizationRoleRecord {
    requireUser(this.context.store, userId);
    requireEnabledOrganization(this.context.store, input.organizationId);
    requireEnabledRole(this.context.store, input.roleId);
    return this.bindToOrganization(userId, input.organizationId, input.roleId);
  }

  removeOrganizationRole(userId: string, organizationId: string): { removed: boolean } {
    const binding = [...this.context.store.userOrganizationRoles.entries()].find(
      ([, candidate]) => candidate.userId === userId && candidate.organizationId === organizationId
    );
    if (!binding) return { removed: false };
    this.context.store.userOrganizationRoles.delete(binding[0]);
    return { removed: true };
  }

  private bindToOrganization(
    userId: string,
    organizationId: string,
    roleId: string
  ): UserOrganizationRoleRecord {
    const existing = [...this.context.store.userOrganizationRoles.values()].find(
      (binding) => binding.userId === userId && binding.organizationId === organizationId
    );
    if (existing) {
      existing.roleId = roleId;
      existing.updatedAt = toUtcIso(nowUtc());
      return existing;
    }

    const now = toUtcIso(nowUtc());
    const binding: UserOrganizationRoleRecord = {
      id: this.context.store.nextId("userOrganizationRole"),
      tenantId: null,
      userId,
      organizationId,
      roleId,
      createdAt: now,
      updatedAt: now
    };
    this.context.store.userOrganizationRoles.set(binding.id, binding);
    return binding;
  }

  private ensureUniqueUser(username: string, email: string, phone: string): void {
    for (const user of this.context.store.users.values()) {
      if (user.isDeleted) continue;
      if (user.username === username) throw createKnownError("VALIDATION_DUPLICATE_USERNAME");
      if (user.email === email) throw createKnownError("VALIDATION_DUPLICATE_EMAIL");
      if (user.phone === phone) throw createKnownError("VALIDATION_DUPLICATE_PHONE");
    }
  }
}
