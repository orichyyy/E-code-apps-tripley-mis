export type EntityStatus = "enabled" | "disabled";
export type UserStatus = EntityStatus | "locked";

export type AuditFields = {
  createdAt: string;
  updatedAt: string;
};

export type ActorAuditFields = {
  createdBy: string | null;
  updatedBy: string | null;
};

export type SoftDeleteFields = {
  isDeleted: boolean;
  deletedAt: string | null;
  deletedBy: string | null;
};

export type OrganizationRecord = AuditFields &
  ActorAuditFields &
  SoftDeleteFields & {
    id: string;
    tenantId: string | null;
    path: bigint;
    level: number;
    segment: number;
    name: string;
    code: string;
    managerUserId: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    sortOrder: number;
    status: EntityStatus;
    remark: string | null;
  };

export type UserRecord = AuditFields &
  ActorAuditFields &
  SoftDeleteFields & {
    id: string;
    tenantId: string | null;
    username: string;
    displayName: string;
    email: string;
    phone: string;
    avatarFileId: string | null;
    gender: string | null;
    employeeNumber: string | null;
    passwordHash: string;
    primaryOrganizationId: string;
    status: UserStatus;
    firstLoginPasswordChangeRequired: boolean;
    passwordChangedAt: string | null;
    passwordExpiresAt: string | null;
    failedLoginAttempts: number;
    lockedUntil: string | null;
    tokenVersion: number;
    lastLoginAt: string | null;
    remark: string | null;
  };

export type RoleRecord = AuditFields &
  SoftDeleteFields & {
    id: string;
    tenantId: string | null;
    name: string;
    code: string;
    status: EntityStatus;
    remark: string | null;
  };

export type UserOrganizationRoleRecord = AuditFields &
  SoftDeleteFields & {
    id: string;
    tenantId: string | null;
    userId: string;
    organizationId: string;
    roleId: string;
  };

export type MenuRecord = AuditFields &
  SoftDeleteFields & {
    id: string;
    tenantId: string | null;
    parentMenuId: string | null;
    code: string;
    titleI18nKey: string;
    path: string;
    requiredPermission: string | null;
    routeCode: string | null;
    icon: string | null;
    sortOrder: number;
    status: EntityStatus;
  };

export type RouteMetadataRecord = AuditFields & {
  id: string;
  tenantId: string | null;
  routeCode: string;
  path: string;
  titleI18nKey: string;
  requiredPermission: string | null;
  menuVisible: boolean;
  icon: string | null;
  sortOrder: number;
  status: EntityStatus;
};

export type PermissionRecord = AuditFields & {
  id: string;
  tenantId: string | null;
  code: string;
  name: string;
  permissionType: "menu" | "page" | "action" | "api" | "data" | "field";
  description: string | null;
  module: string;
  status: EntityStatus;
};

export type ApiPermissionRecord = AuditFields & {
  id: string;
  tenantId: string | null;
  method: string;
  path: string;
  code: string;
  description: string | null;
  module: string;
  requiredPermission: string | null;
  logLevel: "none" | "basic" | "request" | "request_response";
  status: EntityStatus;
  public: boolean;
};

export type AuthSessionRecord = {
  id: string;
  tenantId: string | null;
  userId: string;
  refreshTokenHash: string;
  currentOrganizationId: string;
  ipAddress: string | null;
  userAgent: string | null;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
  lastSeenAt: string;
};

export type RefreshTokenRecord = {
  id: string;
  tenantId: string | null;
  sessionId: string;
  userId: string;
  tokenHash: string;
  tokenVersion: number;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
};

export type InitializationStateRecord = AuditFields & {
  id: string;
  tenantId: string | null;
  status: "uninitialized" | "initialized";
  initializedAt: string | null;
  initializedBy: string | null;
  version: string;
};

export type RolePermissionRecord = {
  roleId: string;
  permissionCode: string;
  createdAt: string;
};

export type PublicOrganization = Omit<OrganizationRecord, "path"> & {
  path: string;
};

export type PublicUser = Omit<UserRecord, "passwordHash">;

export type PublicMenu = MenuRecord;

export type PublicSession = AuthSessionRecord;
