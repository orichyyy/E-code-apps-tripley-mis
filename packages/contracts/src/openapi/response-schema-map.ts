export const responseSchemaByOperationCode: Record<string, string> = {
  "api.context.permissions": "PermissionContextResponse",
  "api.permissions.effective": "PermissionContextResponse",
  "api.roles.data-permissions.view": "RoleDataPermissionListResponse",
  "api.roles.data-permissions.update": "RoleDataPermissionListResponse",
  "api.roles.field-permissions.view": "RoleFieldPermissionListResponse",
  "api.roles.field-permissions.update": "RoleFieldPermissionListResponse",
  "api.permissions.user-overrides.view": "UserPermissionOverrideListResponse",
  "api.permissions.user-overrides.update": "UserPermissionOverrideListResponse"
};
