import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { postgresql, sqlite } from "../src";

describe("backend core schema", () => {
  it("keeps permission metadata columns aligned across SQLite and PostgreSQL", () => {
    expect(sqlite.permissions.module.name).toBe("module");
    expect(sqlite.permissions.resource.name).toBe("resource");
    expect(sqlite.permissions.action.name).toBe("action");
    expect(sqlite.permissions.source.name).toBe("source");
    expect(sqlite.permissions.manifestHash.name).toBe("manifest_hash");
    expect(postgresql.permissions.module.name).toBe("module");
    expect(postgresql.permissions.resource.name).toBe("resource");
    expect(postgresql.permissions.action.name).toBe("action");
    expect(postgresql.permissions.source.name).toBe("source");
    expect(postgresql.permissions.manifestHash.name).toBe("manifest_hash");
  });

  it("keeps role metadata and audit columns aligned across dialects", () => {
    expect(sqlite.roles.description.name).toBe("description");
    expect(sqlite.roles.dataScopeRuleId.name).toBe("data_scope_rule_id");
    expect(sqlite.roles.isBuiltin.name).toBe("is_builtin");
    expect(sqlite.roles.createdBy.name).toBe("created_by");
    expect(sqlite.roles.updatedBy.name).toBe("updated_by");
    expect(postgresql.roles.description.name).toBe("description");
    expect(postgresql.roles.dataScopeRuleId.name).toBe("data_scope_rule_id");
    expect(postgresql.roles.isBuiltin.name).toBe("is_builtin");
    expect(postgresql.roles.createdBy.name).toBe("created_by");
    expect(postgresql.roles.updatedBy.name).toBe("updated_by");
  });

  it("keeps role permission effect metadata aligned across dialects", () => {
    expect(sqlite.rolePermissions.effect.name).toBe("effect");
    expect(sqlite.rolePermissions.updatedAt.name).toBe("updated_at");
    expect(postgresql.rolePermissions.effect.name).toBe("effect");
    expect(postgresql.rolePermissions.updatedAt.name).toBe("updated_at");
  });

  it("keeps user organization role binding soft-delete columns aligned across dialects", () => {
    expect(sqlite.userOrganizationRoles.isPrimary.name).toBe("is_primary");
    expect(sqlite.userOrganizationRoles.status.name).toBe("status");
    expect(sqlite.userOrganizationRoles.createdBy.name).toBe("created_by");
    expect(sqlite.userOrganizationRoles.updatedBy.name).toBe("updated_by");
    expect(sqlite.userOrganizationRoles.isDeleted.name).toBe("is_deleted");
    expect(sqlite.userOrganizationRoles.deletedAt.name).toBe("deleted_at");
    expect(sqlite.userOrganizationRoles.deletedBy.name).toBe("deleted_by");
    expect(postgresql.userOrganizationRoles.isPrimary.name).toBe("is_primary");
    expect(postgresql.userOrganizationRoles.status.name).toBe("status");
    expect(postgresql.userOrganizationRoles.createdBy.name).toBe("created_by");
    expect(postgresql.userOrganizationRoles.updatedBy.name).toBe("updated_by");
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

  it("keeps menu visibility columns aligned across SQLite and PostgreSQL", () => {
    expect(sqlite.menus.visible.name).toBe("visible");
    expect(postgresql.menus.visible.name).toBe("visible");
  });

  it("keeps route manifest metadata columns aligned across SQLite and PostgreSQL", () => {
    expect(sqlite.routeMetadata.metadataJson.name).toBe("metadata_json");
    expect(sqlite.routeMetadata.manifestHash.name).toBe("manifest_hash");
    expect(postgresql.routeMetadata.metadataJson.name).toBe("metadata_json");
    expect(postgresql.routeMetadata.manifestHash.name).toBe("manifest_hash");
  });

  it("keeps login session token-version snapshot columns aligned across dialects", () => {
    expect(sqlite.authSessions.tokenVersion.name).toBe("token_version");
    expect(sqlite.authSessions.status.name).toBe("status");
    expect(postgresql.authSessions.tokenVersion.name).toBe("token_version");
    expect(postgresql.authSessions.status.name).toBe("status");
  });

  it("keeps the root organization segment constraint in both migrations", () => {
    const sqliteMigration = readFileSync(
      new URL("../src/migrations/sqlite/0001_backend_core_foundation.sql", import.meta.url),
      "utf8"
    );
    const postgresqlMigration = readFileSync(
      new URL("../src/migrations/postgresql/0001_backend_core_foundation.sql", import.meta.url),
      "utf8"
    );

    expect(sqliteMigration).toContain("CHECK (level <> 1 OR segment BETWEEN 1 AND 127)");
    expect(postgresqlMigration).toContain("CHECK (level <> 1 OR segment BETWEEN 1 AND 127)");
  });
});
