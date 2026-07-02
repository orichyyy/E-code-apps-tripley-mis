import type {
  AuthSessionRecord,
  OrganizationRecord,
  PublicOrganization,
  PublicSession,
  PublicUser,
  UserRecord
} from "./domain";

export function toPublicOrganization(organization: OrganizationRecord): PublicOrganization {
  return {
    ...organization,
    path: organization.path.toString()
  };
}

export function toPublicUser(user: UserRecord): PublicUser {
  const { passwordHash, ...publicUser } = user;
  void passwordHash;
  return publicUser;
}

export function toPublicSession(session: AuthSessionRecord): PublicSession {
  const { refreshTokenHash, tokenVersion, ...publicSession } = session;
  void refreshTokenHash;
  void tokenVersion;
  return publicSession;
}
