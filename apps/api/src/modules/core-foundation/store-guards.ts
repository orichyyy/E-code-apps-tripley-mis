import type { MenuRecord, OrganizationRecord, RoleRecord, UserRecord } from "./domain";
import type { InMemoryBackendStore } from "./in-memory-store";
import { createKnownError } from "../../core/errors/error-codes";

export function requireIntegerIdString(id: string): string {
  if (!/^[1-9]\d*$/.test(id)) throw createKnownError("VALIDATION_INVALID_REQUEST");
  return id;
}

export function requireUser(store: InMemoryBackendStore, id: string): UserRecord {
  requireIntegerIdString(id);
  const user = store.users.get(id);
  if (!user || user.isDeleted) throw createKnownError("USER_NOT_FOUND");
  return user;
}

export function requireOrganization(store: InMemoryBackendStore, id: string): OrganizationRecord {
  requireIntegerIdString(id);
  const organization = store.organizations.get(id);
  if (!organization || organization.isDeleted) throw createKnownError("ORGANIZATION_NOT_FOUND");
  return organization;
}

export function requireEnabledOrganization(
  store: InMemoryBackendStore,
  id: string
): OrganizationRecord {
  const organization = requireOrganization(store, id);
  if (organization.status === "disabled") throw createKnownError("BUSINESS_ORG_DISABLED");
  return organization;
}

export function requireRole(store: InMemoryBackendStore, id: string): RoleRecord {
  requireIntegerIdString(id);
  const role = store.roles.get(id);
  if (!role || role.isDeleted) throw createKnownError("ROLE_NOT_FOUND");
  return role;
}

export function requireEnabledRole(store: InMemoryBackendStore, id: string): RoleRecord {
  const role = requireRole(store, id);
  if (role.status === "disabled") throw createKnownError("BUSINESS_ROLE_DISABLED");
  return role;
}

export function requireMenu(store: InMemoryBackendStore, id: string): MenuRecord {
  requireIntegerIdString(id);
  const menu = store.menus.get(id);
  if (!menu || menu.isDeleted) throw createKnownError("MENU_NOT_FOUND");
  return menu;
}
