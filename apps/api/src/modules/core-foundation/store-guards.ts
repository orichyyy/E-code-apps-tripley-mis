import type { OrganizationRecord, RoleRecord, UserRecord } from "./domain";
import type { InMemoryBackendStore } from "./in-memory-store";

export function requireUser(store: InMemoryBackendStore, id: string): UserRecord {
  const user = store.users.get(id);
  if (!user || user.isDeleted) throw new Error("USER_NOT_FOUND");
  return user;
}

export function requireOrganization(store: InMemoryBackendStore, id: string): OrganizationRecord {
  const organization = store.organizations.get(id);
  if (!organization || organization.isDeleted) throw new Error("ORGANIZATION_NOT_FOUND");
  return organization;
}

export function requireEnabledOrganization(
  store: InMemoryBackendStore,
  id: string
): OrganizationRecord {
  const organization = requireOrganization(store, id);
  if (organization.status === "disabled") throw new Error("BUSINESS_ORG_DISABLED");
  return organization;
}

export function requireRole(store: InMemoryBackendStore, id: string): RoleRecord {
  const role = store.roles.get(id);
  if (!role || role.isDeleted) throw new Error("ROLE_NOT_FOUND");
  return role;
}

export function requireEnabledRole(store: InMemoryBackendStore, id: string): RoleRecord {
  const role = requireRole(store, id);
  if (role.status === "disabled") throw new Error("BUSINESS_ROLE_DISABLED");
  return role;
}
