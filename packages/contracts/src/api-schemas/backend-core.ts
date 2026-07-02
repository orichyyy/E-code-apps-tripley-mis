import { z } from "zod";

export const integerIdStringSchema = z.string().regex(/^[1-9]\d*$/);

export const initializationSetupRequestSchema = z.object({
  organizationName: z.string().min(1),
  organizationCode: z.string().min(1),
  adminUsername: z.string().min(1),
  adminDisplayName: z.string().min(1),
  adminEmail: z.string().email(),
  adminPhone: z.string().min(1),
  adminPassword: z.string().min(1)
});

export const loginRequestSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

export const changePasswordRequestSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(1)
});

export const switchCurrentOrganizationRequestSchema = z.object({
  organizationId: integerIdStringSchema
});

export const createOrganizationRequestSchema = z.object({
  parentOrganizationId: integerIdStringSchema.optional(),
  name: z.string().min(1),
  code: z.string().min(1),
  managerUserId: integerIdStringSchema.optional(),
  phone: z.string().min(1).optional(),
  email: z.string().email().optional(),
  address: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
  remark: z.string().optional()
});

export const updateOrganizationRequestSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  managerUserId: integerIdStringSchema.nullable().optional(),
  phone: z.string().min(1).nullable().optional(),
  email: z.string().email().nullable().optional(),
  address: z.string().min(1).nullable().optional(),
  sortOrder: z.number().int().optional(),
  remark: z.string().nullable().optional()
});

export const createUserRequestSchema = z.object({
  username: z.string().min(1),
  displayName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  avatarFileId: integerIdStringSchema.optional(),
  gender: z.string().min(1).optional(),
  employeeNumber: z.string().min(1).optional(),
  password: z.string().min(1),
  primaryOrganizationId: integerIdStringSchema,
  roleId: integerIdStringSchema
});

export const updateUserRequestSchema = z.object({
  username: z.string().min(1).optional(),
  displayName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(1).optional(),
  avatarFileId: integerIdStringSchema.nullable().optional(),
  gender: z.string().min(1).nullable().optional(),
  employeeNumber: z.string().min(1).nullable().optional(),
  primaryOrganizationId: integerIdStringSchema.optional(),
  remark: z.string().nullable().optional()
});

export const resetPasswordRequestSchema = z.object({
  password: z.string().min(1)
});

export const assignUserOrganizationRoleRequestSchema = z.object({
  organizationId: integerIdStringSchema,
  roleId: integerIdStringSchema
});

export const createRoleRequestSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  remark: z.string().optional()
});

export const updateRoleRequestSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  remark: z.string().nullable().optional()
});

export const updateRolePermissionsRequestSchema = z.object({
  permissionCodes: z.array(z.string().min(1))
});

export const createMenuRequestSchema = z.object({
  parentMenuId: integerIdStringSchema.optional(),
  code: z.string().min(1),
  titleI18nKey: z.string().min(1),
  path: z.string().min(1),
  requiredPermission: z.string().min(1).optional(),
  routeCode: z.string().min(1).optional(),
  icon: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
  status: z.enum(["enabled", "disabled"]).optional()
});

export const updateMenuRequestSchema = z.object({
  parentMenuId: integerIdStringSchema.nullable().optional(),
  code: z.string().min(1).optional(),
  titleI18nKey: z.string().min(1).optional(),
  path: z.string().min(1).optional(),
  requiredPermission: z.string().min(1).nullable().optional(),
  routeCode: z.string().min(1).nullable().optional(),
  icon: z.string().min(1).nullable().optional(),
  sortOrder: z.number().int().optional(),
  status: z.enum(["enabled", "disabled"]).optional()
});

export type InitializationSetupRequest = z.infer<typeof initializationSetupRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;
export type SwitchCurrentOrganizationRequest = z.infer<
  typeof switchCurrentOrganizationRequestSchema
>;
export type CreateOrganizationRequest = z.infer<typeof createOrganizationRequestSchema>;
export type UpdateOrganizationRequest = z.infer<typeof updateOrganizationRequestSchema>;
export type CreateUserRequest = z.infer<typeof createUserRequestSchema>;
export type UpdateUserRequest = z.infer<typeof updateUserRequestSchema>;
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;
export type AssignUserOrganizationRoleRequest = z.infer<
  typeof assignUserOrganizationRoleRequestSchema
>;
export type CreateRoleRequest = z.infer<typeof createRoleRequestSchema>;
export type UpdateRoleRequest = z.infer<typeof updateRoleRequestSchema>;
export type UpdateRolePermissionsRequest = z.infer<typeof updateRolePermissionsRequestSchema>;
export type CreateMenuRequest = z.infer<typeof createMenuRequestSchema>;
export type UpdateMenuRequest = z.infer<typeof updateMenuRequestSchema>;
