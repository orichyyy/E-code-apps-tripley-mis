import type {
  ApiPermissionRecord,
  AuthSessionRecord,
  InitializationStateRecord,
  MenuApiBindingRecord,
  MenuRecord,
  OrganizationRecord,
  FieldPermissionRuleRecord,
  PermissionRecord,
  RefreshTokenRecord,
  RouteMetadataRecord,
  RoleDataPermissionRecord,
  RolePermissionRecord,
  RoleRecord,
  UserPreferenceRecord,
  UserOrganizationRoleRecord,
  UserPermissionOverrideRecord,
  UserRecord,
} from "./domain";

type SequenceName =
  | "apiPermission"
  | "authSession"
  | "fieldPermissionRule"
  | "initializationState"
  | "menu"
  | "menuApiBinding"
  | "organization"
  | "permission"
  | "refreshToken"
  | "roleDataPermission"
  | "routeMetadata"
  | "role"
  | "user"
  | "userPreference"
  | "userPermissionOverride"
  | "userOrganizationRole";

export class InMemoryBackendStore {
  readonly organizations = new Map<string, OrganizationRecord>();
  readonly users = new Map<string, UserRecord>();
  readonly userPreferences = new Map<string, UserPreferenceRecord>();
  readonly roles = new Map<string, RoleRecord>();
  readonly permissions = new Map<string, PermissionRecord>();
  readonly apiPermissions = new Map<string, ApiPermissionRecord>();
  readonly menus = new Map<string, MenuRecord>();
  readonly menuApiBindings = new Map<string, MenuApiBindingRecord>();
  readonly routeMetadata = new Map<string, RouteMetadataRecord>();
  readonly userOrganizationRoles = new Map<string, UserOrganizationRoleRecord>();
  readonly authSessions = new Map<string, AuthSessionRecord>();
  readonly refreshTokens = new Map<string, RefreshTokenRecord>();
  readonly rolePermissions: RolePermissionRecord[] = [];
  readonly roleDataPermissions = new Map<string, RoleDataPermissionRecord>();
  readonly fieldPermissionRules = new Map<string, FieldPermissionRuleRecord>();
  readonly userPermissionOverrides = new Map<string, UserPermissionOverrideRecord>();
  initializationState: InitializationStateRecord | null = null;

  private readonly sequences = new Map<SequenceName, number>();

  nextId(sequence: SequenceName): string {
    const next = (this.sequences.get(sequence) ?? 0) + 1;
    this.sequences.set(sequence, next);
    return next.toString();
  }

  setSequenceValue(sequence: SequenceName, value: number): void {
    this.sequences.set(sequence, value);
  }
}
