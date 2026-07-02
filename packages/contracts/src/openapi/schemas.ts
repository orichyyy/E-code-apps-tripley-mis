import type { OpenApiDocument, OpenApiSchema } from "./types";

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
  GenericDataEnvelope: envelopeSchema({ type: "object", additionalProperties: true })
};
