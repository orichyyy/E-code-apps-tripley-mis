import type { OrganizationRecord, PublicOrganization, PublicUser, UserRecord } from "./domain";

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
