import { describe, expect, it } from "vitest";

import { postgresql, sqlite } from "../src";

describe("backend core schema", () => {
  it("keeps permission metadata columns aligned across SQLite and PostgreSQL", () => {
    expect(sqlite.permissions.module.name).toBe("module");
    expect(postgresql.permissions.module.name).toBe("module");
  });

  it("keeps user organization role binding soft-delete columns aligned across dialects", () => {
    expect(sqlite.userOrganizationRoles.isDeleted.name).toBe("is_deleted");
    expect(sqlite.userOrganizationRoles.deletedAt.name).toBe("deleted_at");
    expect(sqlite.userOrganizationRoles.deletedBy.name).toBe("deleted_by");
    expect(postgresql.userOrganizationRoles.isDeleted.name).toBe("is_deleted");
    expect(postgresql.userOrganizationRoles.deletedAt.name).toBe("deleted_at");
    expect(postgresql.userOrganizationRoles.deletedBy.name).toBe("deleted_by");
  });

  it("keeps API permission metadata columns aligned across SQLite and PostgreSQL", () => {
    expect(sqlite.apiPermissions.module.name).toBe("module");
    expect(sqlite.apiPermissions.requiredPermission.name).toBe("required_permission");
    expect(sqlite.apiPermissions.public.name).toBe("public");
    expect(postgresql.apiPermissions.module.name).toBe("module");
    expect(postgresql.apiPermissions.requiredPermission.name).toBe("required_permission");
    expect(postgresql.apiPermissions.public.name).toBe("public");
  });

  it("keeps login session token-version snapshot columns aligned across dialects", () => {
    expect(sqlite.authSessions.tokenVersion.name).toBe("token_version");
    expect(postgresql.authSessions.tokenVersion.name).toBe("token_version");
  });
});
