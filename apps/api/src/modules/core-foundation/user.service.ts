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
  requireIntegerIdString,
  requireUser
} from "./store-guards";
import { toPublicUser } from "./serializers";

export class UserService {
  constructor(private readonly context: BackendCoreContext) {}

  list(): PublicUser[] {
    return [...this.context.store.users.values()].filter((user) => !user.isDeleted).map(toPublicUser);
  }

  get(id: string): PublicUser {
    return toPublicUser(requireUser(this.context.store, id));
  }

  async create(
    input: CreateUserRequest,
    actorId: string | null = null
  ): Promise<PublicUser> {
    return toPublicUser(await this.createRecord(input, actorId));
  }

  async createRecord(
    input: CreateUserRequest,
    actorId: string | null = null
  ): Promise<UserRecord> {
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
      avatarFileId: input.avatarFileId ?? null,
      gender: input.gender ?? null,
      employeeNumber: input.employeeNumber ?? null,
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
      updatedAt: toUtcIso(now),
      createdBy: actorId,
      updatedBy: actorId
    };
    this.context.store.users.set(user.id, user);
    this.bindToOrganization(user.id, input.primaryOrganizationId, input.roleId, true, actorId);
    return user;
  }

  update(
    id: string,
    input: UpdateUserRequest,
    actorId: string | null = null
  ): PublicUser {
    const user = requireUser(this.context.store, id);
    this.ensureUniqueUserUpdate(user, input);
    if (input.primaryOrganizationId !== undefined) {
      requireEnabledOrganization(this.context.store, input.primaryOrganizationId);
      this.requireActiveOrganizationBinding(user.id, input.primaryOrganizationId);
    }

    if (input.username !== undefined) user.username = input.username;
    if (input.displayName !== undefined) user.displayName = input.displayName;
    if (input.email !== undefined) user.email = input.email;
    if (input.phone !== undefined) user.phone = input.phone;
    if (input.avatarFileId !== undefined) user.avatarFileId = input.avatarFileId;
    if (input.gender !== undefined) user.gender = input.gender;
    if (input.employeeNumber !== undefined) user.employeeNumber = input.employeeNumber;
    if (input.primaryOrganizationId !== undefined) {
      user.primaryOrganizationId = input.primaryOrganizationId;
      this.markPrimaryOrganization(user.id, input.primaryOrganizationId);
    }
    if (input.remark !== undefined) user.remark = input.remark;
    user.updatedAt = toUtcIso(nowUtc());
    user.updatedBy = actorId;
    return toPublicUser(user);
  }

  setStatus(
    id: string,
    status: "enabled" | "disabled" | "locked",
    actorId: string | null = null
  ): PublicUser {
    const user = requireUser(this.context.store, id);
    const previousStatus = user.status;
    user.status = status;
    if (status === "disabled" && previousStatus !== "disabled") {
      user.tokenVersion += 1;
    }
    if (status === "locked" && previousStatus !== "locked") {
      user.tokenVersion += 1;
    }
    if (status === "enabled") {
      user.lockedUntil = null;
      user.failedLoginAttempts = 0;
    }
    if (status === "locked") {
      user.lockedUntil = null;
    }
    user.updatedAt = toUtcIso(nowUtc());
    user.updatedBy = actorId;
    return toPublicUser(user);
  }

  async resetPassword(
    id: string,
    input: ResetPasswordRequest,
    actorId: string | null = null
  ): Promise<PublicUser> {
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
    user.updatedBy = actorId;
    return toPublicUser(user);
  }

  delete(id: string, deletedBy: string | null = null): PublicUser {
    const user = requireUser(this.context.store, id);
    const now = toUtcIso(nowUtc());
    user.isDeleted = true;
    user.deletedAt = now;
    user.deletedBy = deletedBy;
    user.tokenVersion += 1;
    user.updatedAt = now;
    user.updatedBy = deletedBy;
    return toPublicUser(user);
  }

  assignOrganizationRole(
    userId: string,
    input: AssignUserOrganizationRoleRequest,
    actorId: string | null = null
  ): UserOrganizationRoleRecord {
    const user = requireUser(this.context.store, userId);
    requireEnabledOrganization(this.context.store, input.organizationId);
    requireEnabledRole(this.context.store, input.roleId);
    return this.bindToOrganization(
      userId,
      input.organizationId,
      input.roleId,
      user.primaryOrganizationId === input.organizationId,
      actorId
    );
  }

  listOrganizationRoles(userId: string): UserOrganizationRoleRecord[] {
    requireUser(this.context.store, userId);
    return [...this.context.store.userOrganizationRoles.values()].filter(
      (binding) => binding.userId === userId && !binding.isDeleted
    );
  }

  removeOrganizationRole(
    userId: string,
    organizationId: string,
    deletedBy: string | null = null
  ): { removed: boolean } {
    requireUser(this.context.store, userId);
    requireIntegerIdString(organizationId);
    const binding = [...this.context.store.userOrganizationRoles.values()].find(
      (candidate) =>
        candidate.userId === userId &&
        candidate.organizationId === organizationId &&
        !candidate.isDeleted
    );
    if (!binding) return { removed: false };
    if (binding.isPrimary || requireUser(this.context.store, userId).primaryOrganizationId === organizationId) {
      throw createKnownError("VALIDATION_INVALID_REQUEST");
    }
    const now = toUtcIso(nowUtc());
    binding.isDeleted = true;
    binding.isPrimary = false;
    binding.status = "disabled";
    binding.deletedAt = now;
    binding.deletedBy = deletedBy;
    binding.updatedAt = now;
    return { removed: true };
  }

  private bindToOrganization(
    userId: string,
    organizationId: string,
    roleId: string,
    isPrimary: boolean,
    actorId: string | null = null
  ): UserOrganizationRoleRecord {
    const existing = [...this.context.store.userOrganizationRoles.values()].find(
      (binding) => binding.userId === userId && binding.organizationId === organizationId
    );
    if (existing) {
      existing.roleId = roleId;
      existing.isPrimary = isPrimary;
      existing.status = "enabled";
      existing.isDeleted = false;
      existing.deletedAt = null;
      existing.deletedBy = null;
      existing.updatedAt = toUtcIso(nowUtc());
      existing.updatedBy = actorId;
      if (isPrimary) this.markPrimaryOrganization(userId, organizationId);
      return existing;
    }

    const now = toUtcIso(nowUtc());
    const binding: UserOrganizationRoleRecord = {
      id: this.context.store.nextId("userOrganizationRole"),
      tenantId: null,
      userId,
      organizationId,
      roleId,
      isPrimary,
      status: "enabled",
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
      createdAt: now,
      updatedAt: now,
      createdBy: actorId,
      updatedBy: actorId
    };
    this.context.store.userOrganizationRoles.set(binding.id, binding);
    if (isPrimary) this.markPrimaryOrganization(userId, organizationId);
    return binding;
  }

  private markPrimaryOrganization(userId: string, organizationId: string): void {
    const now = toUtcIso(nowUtc());
    for (const binding of this.context.store.userOrganizationRoles.values()) {
      if (binding.userId !== userId || binding.isDeleted || binding.status !== "enabled") continue;
      binding.isPrimary = binding.organizationId === organizationId;
      binding.updatedAt = now;
    }
  }

  private requireActiveOrganizationBinding(userId: string, organizationId: string): void {
    const binding = [...this.context.store.userOrganizationRoles.values()].find(
      (candidate) =>
        candidate.userId === userId &&
        candidate.organizationId === organizationId &&
        !candidate.isDeleted &&
        candidate.status === "enabled"
    );
    if (!binding) throw createKnownError("VALIDATION_INVALID_REQUEST");
  }

  private ensureUniqueUser(username: string, email: string, phone: string): void {
    for (const user of this.context.store.users.values()) {
      if (user.isDeleted) continue;
      if (user.username === username) throw createKnownError("VALIDATION_DUPLICATE_USERNAME");
      if (user.email === email) throw createKnownError("VALIDATION_DUPLICATE_EMAIL");
      if (user.phone === phone) throw createKnownError("VALIDATION_DUPLICATE_PHONE");
    }
  }

  private ensureUniqueUserUpdate(user: UserRecord, input: UpdateUserRequest): void {
    for (const candidate of this.context.store.users.values()) {
      if (candidate.isDeleted || candidate.id === user.id) continue;
      if (input.username !== undefined && candidate.username === input.username) {
        throw createKnownError("VALIDATION_DUPLICATE_USERNAME");
      }
      if (input.email !== undefined && candidate.email === input.email) {
        throw createKnownError("VALIDATION_DUPLICATE_EMAIL");
      }
      if (input.phone !== undefined && candidate.phone === input.phone) {
        throw createKnownError("VALIDATION_DUPLICATE_PHONE");
      }
    }
  }
}
