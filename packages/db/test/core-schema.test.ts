import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { postgresql, sqlite } from "../src";

type TableWithSymbols = Record<PropertyKey, unknown>;
type ExtraConfigItem = {
  constructor: { name: string };
  name?: string;
};
type SharedSchemaTableName = Exclude<keyof typeof sqlite, "sqliteSchema"> &
  Exclude<keyof typeof postgresql, "postgresqlSchema">;

function getCheckNames(table: unknown): string[] {
  const tableRecord = table as TableWithSymbols;
  const symbols = Object.getOwnPropertySymbols(tableRecord);
  const builderSymbol = symbols.find((symbol) => symbol.toString() === "Symbol(drizzle:ExtraConfigBuilder)");
  const columnsSymbol = symbols.find((symbol) => symbol.toString() === "Symbol(drizzle:ExtraConfigColumns)");

  if (!builderSymbol || !columnsSymbol) {
    return [];
  }

  const buildExtraConfig = tableRecord[builderSymbol] as
    | ((columns: unknown) => Record<string, ExtraConfigItem>)
    | undefined;

  if (!buildExtraConfig) {
    return [];
  }

  return Object.values(buildExtraConfig(tableRecord[columnsSymbol]))
    .filter((item) => item.constructor.name === "CheckBuilder")
    .map((item) => item.name)
    .filter((name): name is string => Boolean(name))
    .sort();
}

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

  it("keeps Drizzle check constraints aligned with backend core enum constraints", () => {
    const expectedChecksByTable = new Map<SharedSchemaTableName, string[]>([
      [
        "organizations",
        [
          "organizations_level_check",
          "organizations_root_segment_check",
          "organizations_segment_check",
          "organizations_status_check"
        ]
      ],
      ["users", ["users_status_check"]],
      ["roles", ["roles_status_check"]],
      ["userOrganizationRoles", ["user_organization_roles_status_check"]],
      ["permissions", ["permissions_status_check", "permissions_type_check"]],
      ["rolePermissions", ["role_permissions_effect_check"]],
      ["menus", ["menus_status_check"]],
      ["routeMetadata", ["route_metadata_status_check"]],
      ["apiPermissions", ["api_permissions_log_level_check", "api_permissions_status_check"]],
      ["authSessions", ["auth_sessions_status_check"]],
      ["systemInitializationState", ["system_initialization_state_status_check"]]
    ]);

    for (const [tableName, expectedChecks] of expectedChecksByTable) {
      expect(getCheckNames(sqlite[tableName])).toEqual(expectedChecks);
      expect(getCheckNames(postgresql[tableName])).toEqual(expectedChecks);
    }
  });
});
