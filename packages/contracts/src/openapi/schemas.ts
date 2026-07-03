import type { OpenApiDocument, OpenApiSchema } from "./types";
import { communicationsComponentSchemas } from "./communications-schemas";
import { systemManagementComponentSchemas } from "./system-management-schemas";

export const idStringSchema: OpenApiSchema = {
  type: "string",
  description: "Database auto-increment ID serialized as a string."
};

export const errorSchema: OpenApiSchema = {
  type: "object",
  required: ["error", "requestId"],
  properties: {
    error: {
      type: "object",
      required: ["code", "message"],
      properties: {
        code: { type: "string" },
        message: { type: "string" },
        details: { type: "object", additionalProperties: true }
      },
      additionalProperties: false
    },
    requestId: { type: "string" }
  },
  additionalProperties: false
};

const envelopeSchema = (data: OpenApiSchema): OpenApiSchema => ({
  type: "object",
  required: ["data"],
  properties: { data },
  additionalProperties: true
});

const auditSchemaProperties: Record<string, OpenApiSchema> = {
  createdAt: { type: "string", format: "date-time" },
  updatedAt: { type: "string", format: "date-time" },
  createdBy: { ...idStringSchema, nullable: true },
  updatedBy: { ...idStringSchema, nullable: true },
  isDeleted: { type: "boolean" },
  deletedAt: { type: "string", format: "date-time", nullable: true },
  deletedBy: { ...idStringSchema, nullable: true }
};

const roleDataPermissionSchema: OpenApiSchema = {
  type: "object",
  required: [
    "id",
    "tenantId",
    "roleId",
    "permissionId",
    "permissionCode",
    "effect",
    "rule",
    "isDeleted",
    "deletedAt",
    "deletedBy",
    "createdAt",
    "updatedAt",
    "createdBy",
    "updatedBy"
  ],
  properties: {
    id: idStringSchema,
    tenantId: { ...idStringSchema, nullable: true },
    roleId: idStringSchema,
    permissionId: idStringSchema,
    permissionCode: { type: "string" },
    effect: { type: "string", enum: ["allow", "deny"] },
    rule: { type: "object", additionalProperties: true },
    ...auditSchemaProperties
  },
  additionalProperties: false
};

const roleFieldPermissionSchema: OpenApiSchema = {
  type: "object",
  required: [
    "id",
    "tenantId",
    "targetType",
    "targetId",
    "resource",
    "field",
    "effect",
    "isDeleted",
    "deletedAt",
    "deletedBy",
    "createdAt",
    "updatedAt",
    "createdBy",
    "updatedBy"
  ],
  properties: {
    id: idStringSchema,
    tenantId: { ...idStringSchema, nullable: true },
    targetType: { type: "string", enum: ["role"] },
    targetId: idStringSchema,
    resource: { type: "string" },
    field: { type: "string" },
    effect: { type: "string", enum: ["visible", "hidden", "readonly"] },
    ...auditSchemaProperties
  },
  additionalProperties: false
};

const userPermissionOverrideSchema: OpenApiSchema = {
  type: "object",
  required: [
    "id",
    "tenantId",
    "userId",
    "permissionId",
    "permissionCode",
    "effect",
    "isDeleted",
    "deletedAt",
    "deletedBy",
    "createdAt",
    "updatedAt",
    "createdBy",
    "updatedBy"
  ],
  properties: {
    id: idStringSchema,
    tenantId: { ...idStringSchema, nullable: true },
    userId: idStringSchema,
    permissionId: idStringSchema,
    permissionCode: { type: "string" },
    effect: { type: "string", enum: ["allow", "deny"] },
    ...auditSchemaProperties
  },
  additionalProperties: false
};

const effectiveDataPermissionSchema: OpenApiSchema = {
  type: "object",
  required: ["roleId", "permissionCode", "effect", "rule"],
  properties: {
    roleId: idStringSchema,
    permissionCode: { type: "string" },
    effect: { type: "string", enum: ["allow", "deny"] },
    rule: { type: "object", additionalProperties: true }
  },
  additionalProperties: false
};

const effectiveFieldPermissionSchema: OpenApiSchema = {
  type: "object",
  required: ["roleId", "resource", "field", "effect"],
  properties: {
    roleId: idStringSchema,
    resource: { type: "string" },
    field: { type: "string" },
    effect: { type: "string", enum: ["visible", "hidden", "readonly"] }
  },
  additionalProperties: false
};

const effectiveUserPermissionOverrideSchema: OpenApiSchema = {
  type: "object",
  required: ["permissionCode", "effect"],
  properties: {
    permissionCode: { type: "string" },
    effect: { type: "string", enum: ["allow", "deny"] }
  },
  additionalProperties: false
};

export const componentSchemas: OpenApiDocument["components"]["schemas"] = {
  ErrorResponse: errorSchema,
  IdString: idStringSchema,
  InitializationSetupRequest: {
    type: "object",
    required: [
      "organizationName",
      "organizationCode",
      "adminUsername",
      "adminDisplayName",
      "adminEmail",
      "adminPhone",
      "adminPassword"
    ],
    properties: {
      organizationName: { type: "string" },
      organizationCode: { type: "string" },
      adminUsername: { type: "string" },
      adminDisplayName: { type: "string" },
      adminEmail: { type: "string", format: "email" },
      adminPhone: { type: "string" },
      adminPassword: { type: "string", format: "password" }
    },
    additionalProperties: false
  },
  LoginRequest: {
    type: "object",
    required: ["username", "password"],
    properties: {
      username: { type: "string" },
      password: { type: "string", format: "password" }
    },
    additionalProperties: false
  },
  LogoutRequest: {
    type: "object",
    properties: { sessionId: idStringSchema },
    additionalProperties: false
  },
  ChangePasswordRequest: {
    type: "object",
    required: ["oldPassword", "newPassword"],
    properties: {
      oldPassword: { type: "string", format: "password" },
      newPassword: { type: "string", format: "password" }
    },
    additionalProperties: false
  },
  SwitchCurrentOrganizationRequest: {
    type: "object",
    required: ["organizationId"],
    properties: { organizationId: idStringSchema },
    additionalProperties: false
  },
  CreateOrganizationRequest: {
    type: "object",
    required: ["name", "code"],
    properties: {
      parentOrganizationId: idStringSchema,
      name: { type: "string" },
      code: { type: "string" },
      managerUserId: idStringSchema,
      phone: { type: "string" },
      email: { type: "string", format: "email" },
      address: { type: "string" },
      sortOrder: { type: "integer" },
      remark: { type: "string" }
    },
    additionalProperties: false
  },
  UpdateOrganizationRequest: {
    type: "object",
    properties: {
      name: { type: "string" },
      code: { type: "string" },
      managerUserId: { ...idStringSchema, nullable: true },
      phone: { type: "string", nullable: true },
      email: { type: "string", format: "email", nullable: true },
      address: { type: "string", nullable: true },
      sortOrder: { type: "integer" },
      remark: { type: "string", nullable: true }
    },
    additionalProperties: false
  },
  UpdateOrganizationDepthConfigRequest: {
    type: "object",
    required: ["maxDepth"],
    properties: { maxDepth: { type: "integer" } },
    additionalProperties: false
  },
  CreateUserRequest: {
    type: "object",
    required: [
      "username",
      "displayName",
      "email",
      "phone",
      "password",
      "primaryOrganizationId",
      "roleId"
    ],
    properties: {
      username: { type: "string" },
      displayName: { type: "string" },
      email: { type: "string", format: "email" },
      phone: { type: "string" },
      avatarFileId: idStringSchema,
      gender: { type: "string" },
      employeeNumber: { type: "string" },
      password: { type: "string", format: "password" },
      primaryOrganizationId: idStringSchema,
      roleId: idStringSchema
    },
    additionalProperties: false
  },
  UpdateUserRequest: {
    type: "object",
    properties: {
      username: { type: "string" },
      displayName: { type: "string" },
      email: { type: "string", format: "email" },
      phone: { type: "string" },
      avatarFileId: { ...idStringSchema, nullable: true },
      gender: { type: "string", nullable: true },
      employeeNumber: { type: "string", nullable: true },
      primaryOrganizationId: idStringSchema,
      remark: { type: "string", nullable: true }
    },
    additionalProperties: false
  },
  UpdateOwnProfileRequest: {
    type: "object",
    properties: {
      displayName: { type: "string" },
      email: { type: "string", format: "email" },
      phone: { type: "string" },
      avatarFileId: { ...idStringSchema, nullable: true },
      gender: { type: "string", nullable: true },
      employeeNumber: { type: "string", nullable: true }
    },
    additionalProperties: false
  },
  UpdateOwnPreferencesRequest: {
    type: "object",
    properties: {
      language: { type: "string", enum: ["en", "zh"] },
      themeMode: { type: "string", enum: ["light", "dark"] },
      themeColor: { type: "string", enum: ["blue", "emerald", "violet", "slate"] },
      pageTabsEnabled: { type: "boolean" }
    },
    additionalProperties: false
  },
  UpdateOwnAvatarRequest: {
    type: "object",
    required: ["avatarFileId"],
    properties: {
      avatarFileId: { ...idStringSchema, nullable: true }
    },
    additionalProperties: false
  },
  ResetPasswordRequest: {
    type: "object",
    required: ["password"],
    properties: { password: { type: "string", format: "password" } },
    additionalProperties: false
  },
  AssignUserOrganizationRoleRequest: {
    type: "object",
    required: ["organizationId", "roleId"],
    properties: {
      organizationId: idStringSchema,
      roleId: idStringSchema
    },
    additionalProperties: false
  },
  CreateRoleRequest: {
    type: "object",
    required: ["name", "code"],
    properties: {
      name: { type: "string" },
      code: { type: "string" },
      description: { type: "string" },
      remark: { type: "string" }
    },
    additionalProperties: false
  },
  UpdateRoleRequest: {
    type: "object",
    properties: {
      name: { type: "string" },
      code: { type: "string" },
      description: { type: "string", nullable: true },
      remark: { type: "string", nullable: true }
    },
    additionalProperties: false
  },
  UpdateRolePermissionsRequest: {
    type: "object",
    required: ["permissionCodes"],
    properties: {
      permissionCodes: { type: "array", items: { type: "string" } }
    },
    additionalProperties: false
  },
  UpdateRoleDataPermissionsRequest: {
    type: "object",
    required: ["rules"],
    properties: {
      rules: {
        type: "array",
        items: {
          type: "object",
          required: ["permissionCode", "rule"],
          properties: {
            permissionCode: { type: "string" },
            effect: { type: "string", enum: ["allow", "deny"] },
            rule: { type: "object", additionalProperties: true }
          },
          additionalProperties: false
        }
      }
    },
    additionalProperties: false
  },
  UpdateRoleFieldPermissionsRequest: {
    type: "object",
    required: ["rules"],
    properties: {
      rules: {
        type: "array",
        items: {
          type: "object",
          required: ["resource", "field", "effect"],
          properties: {
            resource: { type: "string" },
            field: { type: "string" },
            effect: { type: "string", enum: ["visible", "hidden", "readonly"] }
          },
          additionalProperties: false
        }
      }
    },
    additionalProperties: false
  },
  UpdateUserPermissionOverridesRequest: {
    type: "object",
    required: ["overrides"],
    properties: {
      overrides: {
        type: "array",
        items: {
          type: "object",
          required: ["permissionCode", "effect"],
          properties: {
            permissionCode: { type: "string" },
            effect: { type: "string", enum: ["allow", "deny"] }
          },
          additionalProperties: false
        }
      }
    },
    additionalProperties: false
  },
  CreateMenuRequest: {
    type: "object",
    required: ["code", "titleI18nKey", "path"],
    properties: {
      parentMenuId: idStringSchema,
      code: { type: "string" },
      titleI18nKey: { type: "string" },
      path: { type: "string" },
      requiredPermission: { type: "string" },
      routeCode: { type: "string" },
      icon: { type: "string" },
      sortOrder: { type: "integer" },
      visible: { type: "boolean" },
      status: { type: "string", enum: ["enabled", "disabled"] }
    },
    additionalProperties: false
  },
  UpdateMenuRequest: {
    type: "object",
    properties: {
      parentMenuId: { ...idStringSchema, nullable: true },
      code: { type: "string" },
      titleI18nKey: { type: "string" },
      path: { type: "string" },
      requiredPermission: { type: "string", nullable: true },
      routeCode: { type: "string", nullable: true },
      icon: { type: "string", nullable: true },
      sortOrder: { type: "integer" },
      visible: { type: "boolean" },
      status: { type: "string", enum: ["enabled", "disabled"] }
    },
    additionalProperties: false
  },
  UpdateMenuApiBindingsRequest: {
    type: "object",
    required: ["apiPermissionIds"],
    properties: {
      apiPermissionIds: { type: "array", items: idStringSchema }
    },
    additionalProperties: false
  },
  CreateLogExportTaskRequest: {
    type: "object",
    required: ["logType"],
    properties: {
      logType: {
        type: "string",
        enum: ["login", "operation", "access", "api_call", "exception", "security", "scheduler", "file_operation"]
      }
    },
    additionalProperties: false
  },
  FileUploadRequest: {
    type: "object",
    required: ["file"],
    properties: {
      file: {
        type: "string",
        format: "binary",
        description: "Uploaded file. Default limit is 50 MB and allowed extensions are enforced by the file service."
      }
    },
    additionalProperties: false
  },
  CreateNotificationTemplateRequest: {
    type: "object",
    required: ["code", "channel", "locale", "body"],
    properties: {
      code: { type: "string" },
      channel: { type: "string", enum: ["in_app", "email", "sms"] },
      locale: { type: "string" },
      subject: { type: "string", nullable: true },
      body: { type: "string" },
      variables: { type: "array", items: { type: "string" } }
    },
    additionalProperties: false
  },
  UpdateNotificationTemplateRequest: {
    type: "object",
    properties: {
      code: { type: "string" },
      channel: { type: "string", enum: ["in_app", "email", "sms"] },
      locale: { type: "string" },
      subject: { type: "string", nullable: true },
      body: { type: "string" },
      variables: { type: "array", items: { type: "string" } }
    },
    additionalProperties: false
  },
  CreateScheduledTaskRequest: {
    type: "object",
    required: ["code", "cronExpression", "handlerType"],
    properties: {
      code: { type: "string" },
      cronExpression: { type: "string" },
      handlerType: { type: "string" },
      payload: { type: "object", additionalProperties: true },
      enabled: { type: "boolean" }
    },
    additionalProperties: false
  },
  UpdateScheduledTaskRequest: {
    type: "object",
    properties: {
      code: { type: "string" },
      cronExpression: { type: "string" },
      handlerType: { type: "string" },
      payload: { type: "object", additionalProperties: true },
      enabled: { type: "boolean" }
    },
    additionalProperties: false
  },
  CreateExportTaskRequest: {
    type: "object",
    required: ["resourceType"],
    properties: {
      resourceType: { type: "string" }
    },
    additionalProperties: false
  },
  RoleDataPermission: roleDataPermissionSchema,
  RoleFieldPermission: roleFieldPermissionSchema,
  UserPermissionOverride: userPermissionOverrideSchema,
  RoleDataPermissionListResponse: envelopeSchema({
    type: "array",
    items: { $ref: "#/components/schemas/RoleDataPermission" }
  }),
  RoleFieldPermissionListResponse: envelopeSchema({
    type: "array",
    items: { $ref: "#/components/schemas/RoleFieldPermission" }
  }),
  UserPermissionOverrideListResponse: envelopeSchema({
    type: "array",
    items: { $ref: "#/components/schemas/UserPermissionOverride" }
  }),
  UserPreferences: {
    type: "object",
    required: ["id", "tenantId", "userId", "language", "themeMode", "themeColor", "pageTabsEnabled", "updatedAt"],
    properties: {
      id: idStringSchema,
      tenantId: { ...idStringSchema, nullable: true },
      userId: idStringSchema,
      language: { type: "string", enum: ["en", "zh"] },
      themeMode: { type: "string", enum: ["light", "dark"] },
      themeColor: { type: "string", enum: ["blue", "emerald", "violet", "slate"] },
      pageTabsEnabled: { type: "boolean" },
      updatedAt: { type: "string", format: "date-time" }
    },
    additionalProperties: false
  },
  ProfileResponse: envelopeSchema({
    type: "object",
    required: ["user", "preferences"],
    properties: {
      user: { type: "object", additionalProperties: true },
      preferences: { $ref: "#/components/schemas/UserPreferences" }
    },
    additionalProperties: false
  }),
  UserPreferencesResponse: envelopeSchema({
    $ref: "#/components/schemas/UserPreferences"
  }),
  ...communicationsComponentSchemas,
  ...systemManagementComponentSchemas,
  PermissionContextResponse: envelopeSchema({
    type: "object",
    required: [
      "currentOrganization",
      "permissionCodes",
      "menus",
      "dataPermissions",
      "fieldPermissions",
      "userPermissionOverrides"
    ],
    properties: {
      currentOrganization: { type: "object", additionalProperties: true },
      permissionCodes: { type: "array", items: { type: "string" } },
      menus: { type: "array", items: { type: "object", additionalProperties: true } },
      dataPermissions: {
        type: "array",
        items: effectiveDataPermissionSchema
      },
      fieldPermissions: {
        type: "array",
        items: effectiveFieldPermissionSchema
      },
      userPermissionOverrides: {
        type: "array",
        items: effectiveUserPermissionOverrideSchema
      }
    },
    additionalProperties: false
  }),
  LogEntryListResponse: envelopeSchema({
    type: "array",
    items: { type: "object", additionalProperties: true }
  }),
  FileObjectListResponse: envelopeSchema({
    type: "array",
    items: { type: "object", additionalProperties: true }
  }),
  FileObjectResponse: envelopeSchema({ type: "object", additionalProperties: true, nullable: true }),
  FileReferenceListResponse: envelopeSchema({
    type: "array",
    items: {
      type: "object",
      required: ["id", "fileObjectId", "resourceType", "resourceId", "referenceType", "status", "createdAt"],
      properties: {
        id: idStringSchema,
        fileObjectId: idStringSchema,
        resourceType: { type: "string" },
        resourceId: { type: "string" },
        referenceType: { type: "string" },
        status: { type: "string", enum: ["active", "invalid"] },
        createdAt: { type: "string", format: "date-time" },
        createdBy: { ...idStringSchema, nullable: true }
      },
      additionalProperties: false
    }
  }),
  NotificationListResponse: envelopeSchema({
    type: "array",
    items: { type: "object", additionalProperties: true }
  }),
  NotificationStateResponse: envelopeSchema({
    type: "object",
    required: ["id", "status"],
    properties: {
      id: idStringSchema,
      status: { type: "string", enum: ["read", "archived", "deleted"] }
    },
    additionalProperties: true
  }),
  NotificationTemplateListResponse: envelopeSchema({
    type: "array",
    items: { type: "object", additionalProperties: true }
  }),
  NotificationTemplateResponse: envelopeSchema({
    type: "object",
    additionalProperties: true,
    nullable: true
  }),
  ScheduledTaskListResponse: envelopeSchema({
    type: "array",
    items: { type: "object", additionalProperties: true }
  }),
  ScheduledTaskResponse: envelopeSchema({
    type: "object",
    additionalProperties: true,
    nullable: true
  }),
  ImportExportTaskListResponse: envelopeSchema({
    type: "array",
    items: { type: "object", additionalProperties: true }
  }),
  ImportExportTaskResponse: envelopeSchema({
    type: "object",
    additionalProperties: true,
    nullable: true
  }),
  GenericDataEnvelope: envelopeSchema({ type: "object", additionalProperties: true })
};
