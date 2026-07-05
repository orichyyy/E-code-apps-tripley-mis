import { z } from "zod";

export const integerIdStringSchema = z.string().regex(/^[1-9]\d*$/);

export const initializationSetupRequestSchema = z
  .object({
    organizationName: z.string().min(1),
    organizationCode: z.string().min(1),
    adminUsername: z.string().min(1),
    adminDisplayName: z.string().min(1),
    adminEmail: z.string().email(),
    adminPhone: z.string().min(1),
    adminPassword: z.string().min(1),
  })
  .strict();

export const loginRequestSchema = z
  .object({
    username: z.string().min(1),
    password: z.string().min(1),
  })
  .strict();

export const logoutRequestSchema = z
  .object({
    sessionId: integerIdStringSchema.optional(),
  })
  .strict();

export const changePasswordRequestSchema = z
  .object({
    oldPassword: z.string().min(1),
    newPassword: z.string().min(1),
  })
  .strict();

export const switchCurrentOrganizationRequestSchema = z
  .object({
    organizationId: integerIdStringSchema,
  })
  .strict();

export const createOrganizationRequestSchema = z
  .object({
    parentOrganizationId: integerIdStringSchema.optional(),
    name: z.string().min(1),
    code: z.string().min(1),
    managerUserId: integerIdStringSchema.optional(),
    phone: z.string().min(1).optional(),
    email: z.string().email().optional(),
    address: z.string().min(1).optional(),
    sortOrder: z.number().int().optional(),
    remark: z.string().optional(),
  })
  .strict();

export const updateOrganizationRequestSchema = z
  .object({
    name: z.string().min(1).optional(),
    code: z.string().min(1).optional(),
    managerUserId: integerIdStringSchema.nullable().optional(),
    phone: z.string().min(1).nullable().optional(),
    email: z.string().email().nullable().optional(),
    address: z.string().min(1).nullable().optional(),
    sortOrder: z.number().int().optional(),
    remark: z.string().nullable().optional(),
  })
  .strict();

export const updateOrganizationDepthConfigRequestSchema = z
  .object({
    maxDepth: z.number().int().min(1).max(8),
  })
  .strict();

export const createUserRequestSchema = z
  .object({
    username: z.string().min(1),
    displayName: z.string().min(1),
    email: z.string().email(),
    phone: z.string().min(1),
    avatarFileId: integerIdStringSchema.optional(),
    gender: z.string().min(1).optional(),
    employeeNumber: z.string().min(1).optional(),
    password: z.string().min(1),
    primaryOrganizationId: integerIdStringSchema,
    roleId: integerIdStringSchema,
  })
  .strict();

export const updateUserRequestSchema = z
  .object({
    username: z.string().min(1).optional(),
    displayName: z.string().min(1).optional(),
    email: z.string().email().optional(),
    phone: z.string().min(1).optional(),
    avatarFileId: integerIdStringSchema.nullable().optional(),
    gender: z.string().min(1).nullable().optional(),
    employeeNumber: z.string().min(1).nullable().optional(),
    primaryOrganizationId: integerIdStringSchema.optional(),
    remark: z.string().nullable().optional(),
  })
  .strict();

export const userPreferenceLanguageSchema = z.enum(["en", "zh"]);
export const userPreferenceThemeModeSchema = z.enum(["light", "dark"]);
export const userPreferenceThemeColorSchema = z.enum(["blue", "emerald", "violet", "slate"]);

export const updateOwnProfileRequestSchema = z
  .object({
    displayName: z.string().min(1).optional(),
    email: z.string().email().optional(),
    phone: z.string().min(1).optional(),
    avatarFileId: integerIdStringSchema.nullable().optional(),
    gender: z.string().min(1).nullable().optional(),
    employeeNumber: z.string().min(1).nullable().optional(),
  })
  .strict();

export const updateOwnPreferencesRequestSchema = z
  .object({
    language: userPreferenceLanguageSchema.optional(),
    themeMode: userPreferenceThemeModeSchema.optional(),
    themeColor: userPreferenceThemeColorSchema.optional(),
    pageTabsEnabled: z.boolean().optional(),
  })
  .strict();

export const updateOwnAvatarRequestSchema = z
  .object({
    avatarFileId: integerIdStringSchema.nullable(),
  })
  .strict();

export const resetPasswordRequestSchema = z
  .object({
    password: z.string().min(1),
  })
  .strict();

export const assignUserOrganizationRoleRequestSchema = z
  .object({
    organizationId: integerIdStringSchema,
    roleId: integerIdStringSchema,
  })
  .strict();

export const createRoleRequestSchema = z
  .object({
    name: z.string().min(1),
    code: z.string().min(1),
    description: z.string().optional(),
    remark: z.string().optional(),
  })
  .strict();

export const updateRoleRequestSchema = z
  .object({
    name: z.string().min(1).optional(),
    code: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    remark: z.string().nullable().optional(),
  })
  .strict();

export const updateRolePermissionsRequestSchema = z
  .object({
    permissionCodes: z.array(z.string().min(1)),
  })
  .strict();

export const dataPermissionEffectSchema = z.enum(["allow", "deny"]);

export const fieldPermissionEffectSchema = z.enum(["visible", "hidden", "readonly"]);

export const updateRoleDataPermissionsRequestSchema = z
  .object({
    rules: z.array(
      z
        .object({
          permissionCode: z.string().min(1),
          effect: dataPermissionEffectSchema.default("allow"),
          rule: z.record(z.string(), z.unknown()),
        })
        .strict(),
    ),
  })
  .strict();

export const updateRoleFieldPermissionsRequestSchema = z
  .object({
    rules: z.array(
      z
        .object({
          resource: z.string().min(1),
          field: z.string().min(1),
          effect: fieldPermissionEffectSchema,
        })
        .strict(),
    ),
  })
  .strict();

export const updateUserPermissionOverridesRequestSchema = z
  .object({
    overrides: z.array(
      z
        .object({
          permissionCode: z.string().min(1),
          effect: dataPermissionEffectSchema,
        })
        .strict(),
    ),
  })
  .strict();

export const createMenuRequestSchema = z
  .object({
    parentMenuId: integerIdStringSchema.optional(),
    code: z.string().min(1),
    titleI18nKey: z.string().min(1),
    path: z.string().min(1),
    requiredPermission: z.string().min(1).optional(),
    routeCode: z.string().min(1).optional(),
    icon: z.string().min(1).optional(),
    sortOrder: z.number().int().optional(),
    visible: z.boolean().optional(),
    status: z.enum(["enabled", "disabled"]).optional(),
  })
  .strict();

export const updateMenuRequestSchema = z
  .object({
    parentMenuId: integerIdStringSchema.nullable().optional(),
    code: z.string().min(1).optional(),
    titleI18nKey: z.string().min(1).optional(),
    path: z.string().min(1).optional(),
    requiredPermission: z.string().min(1).nullable().optional(),
    routeCode: z.string().min(1).nullable().optional(),
    icon: z.string().min(1).nullable().optional(),
    sortOrder: z.number().int().optional(),
    visible: z.boolean().optional(),
    status: z.enum(["enabled", "disabled"]).optional(),
  })
  .strict();

export const updateMenuApiBindingsRequestSchema = z
  .object({
    apiPermissionIds: z.array(integerIdStringSchema),
  })
  .strict();

export type InitializationSetupRequest = z.infer<typeof initializationSetupRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type LogoutRequest = z.infer<typeof logoutRequestSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;
export type SwitchCurrentOrganizationRequest = z.infer<
  typeof switchCurrentOrganizationRequestSchema
>;
export type CreateOrganizationRequest = z.infer<typeof createOrganizationRequestSchema>;
export type UpdateOrganizationRequest = z.infer<typeof updateOrganizationRequestSchema>;
export type UpdateOrganizationDepthConfigRequest = z.infer<
  typeof updateOrganizationDepthConfigRequestSchema
>;
export type CreateUserRequest = z.infer<typeof createUserRequestSchema>;
export type UpdateUserRequest = z.infer<typeof updateUserRequestSchema>;
export type UserPreferenceLanguage = z.infer<typeof userPreferenceLanguageSchema>;
export type UserPreferenceThemeMode = z.infer<typeof userPreferenceThemeModeSchema>;
export type UserPreferenceThemeColor = z.infer<typeof userPreferenceThemeColorSchema>;
export type UpdateOwnProfileRequest = z.infer<typeof updateOwnProfileRequestSchema>;
export type UpdateOwnPreferencesRequest = z.infer<typeof updateOwnPreferencesRequestSchema>;
export type UpdateOwnAvatarRequest = z.infer<typeof updateOwnAvatarRequestSchema>;
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;
export type AssignUserOrganizationRoleRequest = z.infer<
  typeof assignUserOrganizationRoleRequestSchema
>;
export type CreateRoleRequest = z.infer<typeof createRoleRequestSchema>;
export type UpdateRoleRequest = z.infer<typeof updateRoleRequestSchema>;
export type UpdateRolePermissionsRequest = z.infer<typeof updateRolePermissionsRequestSchema>;
export type UpdateRoleDataPermissionsRequest = z.infer<
  typeof updateRoleDataPermissionsRequestSchema
>;
export type UpdateRoleFieldPermissionsRequest = z.infer<
  typeof updateRoleFieldPermissionsRequestSchema
>;
export type UpdateUserPermissionOverridesRequest = z.infer<
  typeof updateUserPermissionOverridesRequestSchema
>;
export type CreateMenuRequest = z.infer<typeof createMenuRequestSchema>;
export type UpdateMenuRequest = z.infer<typeof updateMenuRequestSchema>;
export type UpdateMenuApiBindingsRequest = z.infer<typeof updateMenuApiBindingsRequestSchema>;
