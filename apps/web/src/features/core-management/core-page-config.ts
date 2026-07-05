import {
  copyRole,
  createMenu,
  createOrganization,
  createRole,
  createUser,
  deleteMenu,
  deleteOrganization,
  deleteRole,
  deleteUser,
  fetchMenus,
  fetchOrganizations,
  fetchPermissions,
  fetchRoles,
  fetchUsers,
  resetUserPassword,
  setOrganizationStatus,
  setRoleStatus,
  setUserStatus,
  updateMenu,
  updateOrganization,
  updateRole,
  updateUser
} from "./core-management-api";
import type { CoreColumn } from "./core-entity-table";
import {
  displayValue,
  toOption,
  type CoreEntity,
  type CoreField,
  type CoreFormValues,
  type CorePageKind
} from "./core-management-model";

export type PageConfig = {
  columns: CoreColumn[];
  create?: (values: CoreFormValues) => Promise<unknown>;
  delete?: boolean;
  description: string;
  fetch: (keyword: string) => Promise<CoreEntity[]>;
  fields: (options: { organizations: CoreEntity[]; roles: CoreEntity[]; menus: CoreEntity[] }) => CoreField[];
  initialValues: (record?: CoreEntity) => CoreFormValues;
  label: string;
  sidePanel: string;
  statusActions?: (record: CoreEntity) => Array<{ action: string; label: string }>;
  update?: (id: string, values: CoreFormValues) => Promise<unknown>;
};

export function getPageConfig(kind: CorePageKind): PageConfig {
  const configs = {
    users: userConfig,
    organizations: organizationConfig,
    roles: roleConfig,
    permissions: permissionConfig,
    menus: menuConfig
  } satisfies Record<CorePageKind, PageConfig>;
  return configs[kind];
}

export async function runRecordAction(kind: CorePageKind, record: CoreEntity, action: string): Promise<unknown> {
  if (kind === "users") {
    if (action === "delete") return deleteUser(record.id);
    if (action === "reset-password") {
      const password = typeof window === "undefined" ? "" : window.prompt("New password");
      return password ? resetUserPassword(record.id, password) : Promise.resolve();
    }
    return setUserStatus(record.id, action as "enable" | "disable" | "lock" | "unlock");
  }
  if (kind === "organizations") {
    if (action === "delete") return deleteOrganization(record.id);
    return setOrganizationStatus(record.id, action as "enable" | "disable");
  }
  if (kind === "roles") {
    if (action === "delete") return deleteRole(record.id);
    if (action === "copy") return copyRole(record.id);
    return setRoleStatus(record.id, action as "enable" | "disable");
  }
  if (kind === "menus" && action === "delete") {
    return deleteMenu(record.id);
  }
  return Promise.resolve();
}

const userConfig: PageConfig = {
  columns: [
    { key: "name", label: "User", values: ["displayName", "username"] },
    { key: "email", label: "Email", values: ["email"] },
    { key: "phone", label: "Phone", values: ["phone"] },
    { key: "status", label: "Status", values: ["status"] },
    { key: "updatedAt", label: "Updated", values: ["updatedAt"] }
  ],
  create: createUser,
  delete: true,
  description: "Manage login accounts, profile fields, lifecycle state, and password resets.",
  fetch: fetchUsers,
  fields: ({ organizations, roles }) => [
    { name: "username", label: "Username", required: true },
    { name: "displayName", label: "Display name", required: true },
    { name: "email", label: "Email", required: true, type: "email" },
    { name: "phone", label: "Phone", required: true },
    { name: "password", label: "Initial password", required: true, type: "password" },
    { name: "primaryOrganizationId", label: "Primary organization", required: true, type: "select", options: organizations.map((item) => toOption(item, item.id)) },
    { name: "roleId", label: "Role", required: true, type: "select", options: roles.map((item) => toOption(item, item.id)) },
    { name: "employeeNumber", label: "Employee number" },
    { name: "remark", label: "Remark", type: "textarea" }
  ],
  initialValues: (record) => ({
    username: displayValue(entity(record), ["username"], ""),
    displayName: displayValue(entity(record), ["displayName"], ""),
    email: displayValue(entity(record), ["email"], ""),
    phone: displayValue(entity(record), ["phone"], ""),
    password: "",
    primaryOrganizationId: displayValue(entity(record), ["primaryOrganizationId"], ""),
    roleId: "",
    employeeNumber: displayValue(entity(record), ["employeeNumber"], ""),
    remark: displayValue(entity(record), ["remark"], "")
  }),
  label: "user",
  sidePanel: "Create users with a primary organization and one role, then manage status or reset passwords from the table.",
  statusActions: (record) => userStatusActions(displayValue(record, ["status"], "")),
  update: updateUser
};

const organizationConfig: PageConfig = {
  columns: [
    { key: "name", label: "Organization", values: ["name"] },
    { key: "code", label: "Code", values: ["code"] },
    { key: "level", label: "Level", values: ["level"] },
    { key: "status", label: "Status", values: ["status"] },
    { key: "updatedAt", label: "Updated", values: ["updatedAt"] }
  ],
  create: createOrganization,
  delete: true,
  description: "Maintain the materialized-path organization tree without v1 move operations.",
  fetch: () => fetchOrganizations(),
  fields: ({ organizations }) => [
    { name: "parentOrganizationId", label: "Parent organization", type: "select", options: organizations.map((item) => toOption(item, item.id)) },
    { name: "name", label: "Name", required: true },
    { name: "code", label: "Code", required: true },
    { name: "email", label: "Email", type: "email" },
    { name: "phone", label: "Phone" },
    { name: "sortOrder", label: "Sort order", type: "number" },
    { name: "remark", label: "Remark", type: "textarea" }
  ],
  initialValues: (record) => ({
    parentOrganizationId: "",
    name: displayValue(entity(record), ["name"], ""),
    code: displayValue(entity(record), ["code"], ""),
    email: displayValue(entity(record), ["email"], ""),
    phone: displayValue(entity(record), ["phone"], ""),
    sortOrder: displayValue(entity(record), ["sortOrder"], ""),
    remark: displayValue(entity(record), ["remark"], "")
  }),
  label: "organization",
  sidePanel: "Disable cascades to child organizations. Historical data stays retained and queryable.",
  statusActions: (record) => [
    { action: displayValue(record, ["status"], "") === "enabled" ? "disable" : "enable", label: displayValue(record, ["status"], "") === "enabled" ? "Disable" : "Enable" }
  ],
  update: updateOrganization
};

const roleConfig: PageConfig = {
  columns: [
    { key: "name", label: "Role", values: ["name"] },
    { key: "code", label: "Code", values: ["code"] },
    { key: "status", label: "Status", values: ["status"] },
    { key: "builtin", label: "Built-in", values: ["isBuiltin"] },
    { key: "updatedAt", label: "Updated", values: ["updatedAt"] }
  ],
  create: createRole,
  delete: true,
  description: "Manage RBAC roles and assign permission grants from the side panel.",
  fetch: fetchRoles,
  fields: () => [
    { name: "name", label: "Name", required: true },
    { name: "code", label: "Code", required: true },
    { name: "description", label: "Description", type: "textarea" },
    { name: "remark", label: "Remark", type: "textarea" }
  ],
  initialValues: (record) => ({
    name: displayValue(entity(record), ["name"], ""),
    code: displayValue(entity(record), ["code"], ""),
    description: displayValue(entity(record), ["description"], ""),
    remark: displayValue(entity(record), ["remark"], "")
  }),
  label: "role",
  sidePanel: "Select a role to assign permission codes. User overrides still take priority over role grants.",
  statusActions: (record) => [
    { action: displayValue(record, ["status"], "") === "enabled" ? "disable" : "enable", label: displayValue(record, ["status"], "") === "enabled" ? "Disable" : "Enable" },
    { action: "copy", label: "Copy" }
  ],
  update: updateRole
};

const permissionConfig: PageConfig = {
  columns: [
    { key: "code", label: "Code", values: ["code"] },
    { key: "module", label: "Module", values: ["module"] },
    { key: "resource", label: "Resource", values: ["resource"] },
    { key: "action", label: "Action", values: ["action"] },
    { key: "status", label: "Status", values: ["status"] }
  ],
  description: "Review generated permission metadata and run manifest sync when backend manifests change.",
  fetch: fetchPermissions,
  fields: () => [],
  initialValues: () => ({}),
  label: "permission",
  sidePanel: "Permission tree is derived virtually from module, resource, action, and type metadata."
};

const menuConfig: PageConfig = {
  columns: [
    { key: "title", label: "Title key", values: ["titleI18nKey"] },
    { key: "code", label: "Code", values: ["code"] },
    { key: "path", label: "Path", values: ["path"] },
    { key: "status", label: "Status", values: ["status"] },
    { key: "visible", label: "Visible", values: ["visible"] }
  ],
  create: createMenu,
  delete: true,
  description: "Manage base menus, route bindings, visibility, and API permission bindings.",
  fetch: () => fetchMenus(),
  fields: ({ menus }) => [
    { name: "parentMenuId", label: "Parent menu", type: "select", options: menus.map((item) => toOption(item, item.id)) },
    { name: "code", label: "Code", required: true },
    { name: "titleI18nKey", label: "Title i18n key", required: true },
    { name: "path", label: "Path", required: true },
    { name: "requiredPermission", label: "Required permission" },
    { name: "routeCode", label: "Route code" },
    { name: "icon", label: "Icon" },
    { name: "sortOrder", label: "Sort order", type: "number" },
    { name: "visible", label: "Visible", type: "checkbox" }
  ],
  initialValues: (record) => ({
    parentMenuId: "",
    code: displayValue(entity(record), ["code"], ""),
    titleI18nKey: displayValue(entity(record), ["titleI18nKey"], ""),
    path: displayValue(entity(record), ["path"], ""),
    requiredPermission: displayValue(entity(record), ["requiredPermission"], ""),
    routeCode: displayValue(entity(record), ["routeCode"], ""),
    icon: displayValue(entity(record), ["icon"], ""),
    sortOrder: displayValue(entity(record), ["sortOrder"], ""),
    visible: record ? Boolean(record.visible) : true
  }),
  label: "menu",
  sidePanel: "Select a menu to bind API permissions that describe the backend surface it exposes.",
  update: updateMenu
};

function entity(record: CoreEntity | undefined): CoreEntity {
  return record ?? { id: "" };
}

function userStatusActions(status: string): Array<{ action: string; label: string }> {
  if (status === "locked") {
    return [
      { action: "unlock", label: "Unlock" },
      { action: "reset-password", label: "Reset password" }
    ];
  }
  return [
    { action: status === "enabled" ? "disable" : "enable", label: status === "enabled" ? "Disable" : "Enable" },
    { action: "lock", label: "Lock" },
    { action: "reset-password", label: "Reset password" }
  ];
}
