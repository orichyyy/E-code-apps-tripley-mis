import type {
  AssignUserOrganizationRoleRequest,
  CreateUserRequest,
  UpdateRoleDataPermissionsRequest,
  UpdateRoleFieldPermissionsRequest,
  UpdateRolePermissionsRequest,
  UpdateUserPermissionOverridesRequest,
  WebhookOutboxEvent,
} from "@web-admin-base/contracts";

import { BackendCoreServices } from "../services";
import type { PersistenceScope } from "./backend-core-persistence-coordinator";
import {
  createPermissionChangedEvent,
  createWebhookEvent,
  dataPermissionValue,
  equalUnorderedValues,
  fieldPermissionValue,
  permissionManifestValues,
  userOverrideValue,
} from "./webhook-domain-events";

export abstract class WebhookAwareBackendCoreServices extends BackendCoreServices {
  protected abstract persistAfter<T>(
    operation: () => T | Promise<T>,
    scopes: PersistenceScope[],
    eventFactory?: (result: Awaited<T>) => WebhookOutboxEvent | null,
  ): Promise<Awaited<T>>;

  override async createUser(input: CreateUserRequest, actorId: string | null = null) {
    return this.persistAfter(
      () => super.createUser(input, actorId),
      ["users", "userOrganizationRoles"],
      (user) =>
        createWebhookEvent({
          type: "user.created",
          subject: `users/${user.id}`,
          data: {
            userId: user.id,
            primaryOrganizationId: input.primaryOrganizationId,
            createdByUserId: actorId,
          },
        }),
    );
  }

  override async assignUserOrganizationRole(
    userId: string,
    input: AssignUserOrganizationRoleRequest,
    actorId: string | null = null,
  ) {
    const previous = this.listUserOrganizationRoles(userId).find(
      (binding) => binding.organizationId === input.organizationId,
    );
    return this.persistAfter(
      () => super.assignUserOrganizationRole(userId, input, actorId),
      ["users", "userOrganizationRoles"],
      (binding) =>
        previous?.roleId === binding.roleId &&
        previous.isPrimary === binding.isPrimary &&
        previous.status === binding.status
          ? null
          : createPermissionChangedEvent({
              targetType: "userOrganizationBinding",
              targetId: userId,
              organizationId: input.organizationId,
              changeType: "roleBinding",
              actorId,
            }),
    );
  }

  override async removeUserOrganizationRole(
    userId: string,
    organizationId: string,
    deletedBy: string | null = null,
  ) {
    return this.persistAfter(
      () => super.removeUserOrganizationRole(userId, organizationId, deletedBy),
      ["users", "userOrganizationRoles"],
      (result) =>
        result.removed
          ? createPermissionChangedEvent({
              targetType: "userOrganizationBinding",
              targetId: userId,
              organizationId,
              changeType: "roleBinding",
              actorId: deletedBy,
            })
          : null,
    );
  }

  override async updateRolePermissions(
    id: string,
    input: UpdateRolePermissionsRequest,
    actorId: string | null = null,
  ) {
    const before = this.listRolePermissionCodes(id);
    return this.persistAfter(
      () => super.updateRolePermissions(id, input, actorId),
      ["roles"],
      () =>
        this.permissionChangeEvent(
          before,
          this.listRolePermissionCodes(id),
          id,
          "rolePermissions",
          actorId,
        ),
    );
  }

  override async updateRoleDataPermissions(
    id: string,
    input: UpdateRoleDataPermissionsRequest,
    actorId: string | null = null,
  ) {
    const before = this.listRoleDataPermissions(id).map(dataPermissionValue);
    return this.persistAfter(
      () => super.updateRoleDataPermissions(id, input, actorId),
      ["permissionExtensions"],
      (records) =>
        this.permissionChangeEvent(
          before,
          records.map(dataPermissionValue),
          id,
          "dataPermissions",
          actorId,
        ),
    );
  }

  override async updateRoleFieldPermissions(
    id: string,
    input: UpdateRoleFieldPermissionsRequest,
    actorId: string | null = null,
  ) {
    const before = this.listRoleFieldPermissions(id).map(fieldPermissionValue);
    return this.persistAfter(
      () => super.updateRoleFieldPermissions(id, input, actorId),
      ["permissionExtensions"],
      (records) =>
        this.permissionChangeEvent(
          before,
          records.map(fieldPermissionValue),
          id,
          "fieldPermissions",
          actorId,
        ),
    );
  }

  override async updateUserPermissionOverrides(
    userId: string,
    input: UpdateUserPermissionOverridesRequest,
    actorId: string | null = null,
  ) {
    const before = this.listUserPermissionOverrides(userId).map(userOverrideValue);
    return this.persistAfter(
      () => super.updateUserPermissionOverrides(userId, input, actorId),
      ["permissionExtensions"],
      (records) =>
        this.permissionChangeEvent(
          before,
          records.map(userOverrideValue),
          userId,
          "userOverrides",
          actorId,
          "user",
        ),
    );
  }

  override syncPermissions() {
    const before = permissionManifestValues(this.listPermissions(), this.listApiPermissions());
    return this.persistAfter(
      () => super.syncPermissions(),
      ["permissions"],
      () =>
        equalUnorderedValues(
          before,
          permissionManifestValues(this.listPermissions(), this.listApiPermissions()),
        )
          ? null
          : createPermissionChangedEvent({
              targetType: "system",
              targetId: "permission-manifest",
              organizationId: null,
              changeType: "manifestSync",
              actorId: null,
            }),
    );
  }

  private permissionChangeEvent(
    before: readonly unknown[],
    after: readonly unknown[],
    targetId: string,
    changeType: "rolePermissions" | "dataPermissions" | "fieldPermissions" | "userOverrides",
    actorId: string | null,
    targetType: "role" | "user" = "role",
  ): WebhookOutboxEvent | null {
    return equalUnorderedValues(before, after)
      ? null
      : createPermissionChangedEvent({
          targetType,
          targetId,
          organizationId: null,
          changeType,
          actorId,
        });
  }
}
