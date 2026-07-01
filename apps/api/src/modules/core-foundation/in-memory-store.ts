import type {
  AuthSessionRecord,
  InitializationStateRecord,
  OrganizationRecord,
  RefreshTokenRecord,
  RolePermissionRecord,
  RoleRecord,
  UserOrganizationRoleRecord,
  UserRecord
} from "./domain";

type SequenceName =
  | "authSession"
  | "initializationState"
  | "organization"
  | "refreshToken"
  | "role"
  | "user"
  | "userOrganizationRole";

export class InMemoryBackendStore {
  readonly organizations = new Map<string, OrganizationRecord>();
  readonly users = new Map<string, UserRecord>();
  readonly roles = new Map<string, RoleRecord>();
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
