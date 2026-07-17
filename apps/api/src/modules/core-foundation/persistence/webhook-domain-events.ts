import type { WebhookOutboxEvent } from "@web-admin-base/contracts";

import type {
  ApiPermissionRecord,
  FieldPermissionRuleRecord,
  PermissionRecord,
  RoleDataPermissionRecord,
  UserPermissionOverrideRecord,
} from "../domain";

type PermissionChangeType =
  | "rolePermissions"
  | "dataPermissions"
  | "fieldPermissions"
  | "userOverrides"
  | "roleBinding"
  | "manifestSync";

type PermissionTargetType = "role" | "user" | "userOrganizationBinding" | "system";

export function createWebhookEvent(
  event: Omit<WebhookOutboxEvent, "occurredAt">,
): WebhookOutboxEvent {
  return { ...event, occurredAt: new Date().toISOString() } as WebhookOutboxEvent;
}

export function createPermissionChangedEvent(input: {
  targetType: PermissionTargetType;
  targetId: string;
  organizationId: string | null;
  changeType: PermissionChangeType;
  actorId: string | null;
}): WebhookOutboxEvent {
  return createWebhookEvent({
    type: "permission.changed",
    subject: `permissions/${input.targetType}/${input.targetId}`,
    data: {
      targetType: input.targetType,
      targetId: input.targetId,
      organizationId: input.organizationId,
      changeType: input.changeType,
      changedByUserId: input.actorId,
    },
  });
}

export function equalUnorderedValues(left: readonly unknown[], right: readonly unknown[]): boolean {
  return fingerprint(left) === fingerprint(right);
}

export function dataPermissionValue(record: RoleDataPermissionRecord) {
  return { permissionCode: record.permissionCode, effect: record.effect, rule: record.rule };
}

export function fieldPermissionValue(record: FieldPermissionRuleRecord) {
  return { resource: record.resource, field: record.field, effect: record.effect };
}

export function userOverrideValue(record: UserPermissionOverrideRecord) {
  return { permissionCode: record.permissionCode, effect: record.effect };
}

export function permissionManifestValues(
  permissions: PermissionRecord[],
  apiPermissions: ApiPermissionRecord[],
): unknown[] {
  return [
    ...permissions.map((permission) => ({
      kind: "permission",
      code: permission.code,
      name: permission.name,
      permissionType: permission.permissionType,
      resource: permission.resource,
      action: permission.action,
      description: permission.description,
      module: permission.module,
      source: permission.source,
      manifestHash: permission.manifestHash,
      status: permission.status,
    })),
    ...apiPermissions.map((permission) => ({
      kind: "api",
      method: permission.method,
      path: permission.path,
      code: permission.code,
      description: permission.description,
      module: permission.module,
      requiredPermission: permission.requiredPermission,
      logLevel: permission.logLevel,
      status: permission.status,
      public: permission.public,
    })),
  ];
}

function fingerprint(values: readonly unknown[]): string {
  return values.map(stableSerialize).sort().join("\n");
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}
