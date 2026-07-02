import type {
  ApiPermissionRecord,
  AuthSessionRecord,
  InitializationStateRecord,
  MenuApiBindingRecord,
  MenuRecord,
  OrganizationRecord,
  PermissionRecord,
  RefreshTokenRecord,
  RouteMetadataRecord,
  RolePermissionRecord,
  RoleRecord,
  UserOrganizationRoleRecord,
  UserRecord
} from "./domain";

type SequenceName =
  | "apiPermission"
  | "authSession"
  | "initializationState"
  | "menu"
  | "menuApiBinding"
  | "organization"
  | "permission"
  | "refreshToken"
  | "routeMetadata"
  | "role"
  | "user"
  | "userOrganizationRole";

export class InMemoryBackendStore {
  readonly organizations = new Map<string, OrganizationRecord>();
  readonly users = new Map<string, UserRecord>();
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
  initializationState: InitializationStateRecord | null = null;

  private readonly sequences = new Map<SequenceName, number>();

  nextId(sequence: SequenceName): string {
    const next = (this.sequences.get(sequence) ?? 0) + 1;
    this.sequences.set(sequence, next);
    return next.toString();
  }
}
