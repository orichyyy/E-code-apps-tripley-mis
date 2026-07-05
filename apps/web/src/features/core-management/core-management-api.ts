import { requestJson } from "@/lib/api-request";
import {
  compactPayload,
  flattenTree,
  parseCoreEntities,
  type CoreEntity,
  type CoreFormValues,
} from "./core-management-model";

type Envelope<T> = {
  data: T;
};

export async function fetchUsers(keyword = ""): Promise<CoreEntity[]> {
  const query = new URLSearchParams({ page: "1", pageSize: "100" });
  if (keyword) query.set("keyword", keyword);
  const envelope = await requestJson<Envelope<unknown>>(`/users?${query.toString()}`);
  return parseCoreEntities(envelope.data);
}

export async function fetchOrganizations(): Promise<CoreEntity[]> {
  const envelope = await requestJson<Envelope<unknown>>("/organizations/tree");
  return flattenTree(envelope.data);
}

export async function fetchRoles(keyword = ""): Promise<CoreEntity[]> {
  const query = new URLSearchParams({ page: "1", pageSize: "100" });
  if (keyword) query.set("keyword", keyword);
  const envelope = await requestJson<Envelope<unknown>>(`/roles?${query.toString()}`);
  return parseCoreEntities(envelope.data);
}

export async function fetchPermissions(keyword = ""): Promise<CoreEntity[]> {
  const query = new URLSearchParams();
  if (keyword) query.set("keyword", keyword);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  const envelope = await requestJson<Envelope<unknown>>(`/permissions${suffix}`);
  return parseCoreEntities(envelope.data);
}

export async function fetchApiPermissions(): Promise<CoreEntity[]> {
  const envelope = await requestJson<Envelope<unknown>>("/permissions/api");
  return parseCoreEntities(envelope.data);
}

export async function fetchMenus(): Promise<CoreEntity[]> {
  const envelope = await requestJson<Envelope<unknown>>("/menus/tree");
  return flattenTree(envelope.data);
}

export async function createUser(values: CoreFormValues): Promise<unknown> {
  return requestJson("/users", {
    method: "POST",
    body: JSON.stringify(compactPayload(values)),
  });
}

export async function updateUser(id: string, values: CoreFormValues): Promise<unknown> {
  return requestJson(`/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(compactPayload(values)),
  });
}

export async function setUserStatus(
  id: string,
  action: "enable" | "disable" | "lock" | "unlock",
): Promise<unknown> {
  return requestJson(`/users/${id}/${action}`, { method: "POST" });
}

export async function deleteUser(id: string): Promise<unknown> {
  return requestJson(`/users/${id}`, { method: "DELETE" });
}

export async function resetUserPassword(id: string, password: string): Promise<unknown> {
  return requestJson(`/users/${id}/reset-password`, {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export async function createOrganization(values: CoreFormValues): Promise<unknown> {
  return requestJson("/organizations", {
    method: "POST",
    body: JSON.stringify(compactPayload(values)),
  });
}

export async function updateOrganization(id: string, values: CoreFormValues): Promise<unknown> {
  return requestJson(`/organizations/${id}`, {
    method: "PATCH",
    body: JSON.stringify(compactPayload(values)),
  });
}

export async function setOrganizationStatus(
  id: string,
  action: "enable" | "disable",
): Promise<unknown> {
  return requestJson(`/organizations/${id}/${action}`, { method: "POST" });
}

export async function deleteOrganization(id: string): Promise<unknown> {
  return requestJson(`/organizations/${id}`, { method: "DELETE" });
}

export async function createRole(values: CoreFormValues): Promise<unknown> {
  return requestJson("/roles", {
    method: "POST",
    body: JSON.stringify(compactPayload(values)),
  });
}

export async function updateRole(id: string, values: CoreFormValues): Promise<unknown> {
  return requestJson(`/roles/${id}`, {
    method: "PATCH",
    body: JSON.stringify(compactPayload(values)),
  });
}

export async function setRoleStatus(id: string, action: "enable" | "disable"): Promise<unknown> {
  return requestJson(`/roles/${id}/${action}`, { method: "POST" });
}

export async function deleteRole(id: string): Promise<unknown> {
  return requestJson(`/roles/${id}`, { method: "DELETE" });
}

export async function copyRole(id: string): Promise<unknown> {
  return requestJson(`/roles/${id}/copy`, { method: "POST" });
}

export async function fetchRolePermissions(id: string): Promise<string[]> {
  const envelope = await requestJson<Envelope<unknown>>(`/roles/${id}/permissions`);
  return Array.isArray(envelope.data)
    ? envelope.data.filter((code): code is string => typeof code === "string")
    : [];
}

export async function updateRolePermissions(
  id: string,
  permissionCodes: string[],
): Promise<unknown> {
  return requestJson(`/roles/${id}/permissions`, {
    method: "PUT",
    body: JSON.stringify({ permissionCodes }),
  });
}

export async function syncPermissions(): Promise<unknown> {
  return requestJson("/permissions/sync", { method: "POST" });
}

export async function createMenu(values: CoreFormValues): Promise<unknown> {
  return requestJson("/menus", {
    method: "POST",
    body: JSON.stringify(compactPayload(values)),
  });
}

export async function updateMenu(id: string, values: CoreFormValues): Promise<unknown> {
  return requestJson(`/menus/${id}`, {
    method: "PATCH",
    body: JSON.stringify(compactPayload(values)),
  });
}

export async function deleteMenu(id: string): Promise<unknown> {
  return requestJson(`/menus/${id}`, { method: "DELETE" });
}

export async function updateMenuApiBindings(
  id: string,
  apiPermissionIds: string[],
): Promise<unknown> {
  return requestJson(`/menus/${id}/api-bindings`, {
    method: "PUT",
    body: JSON.stringify({ apiPermissionIds }),
  });
}
