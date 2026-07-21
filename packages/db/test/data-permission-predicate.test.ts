import type { NeutralDataPredicate } from "@web-admin-base/contracts";
import { createBusinessPermissionEnforcer } from "@web-admin-base/module-sdk";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";

import { createSqliteClient, toDrizzleDataPredicate } from "../src";
import { businessPermissionFixture } from "./fixtures/business-permission-module";

const records = sqliteTable("permission_records", {
  id: integer("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  ownerUserId: text("owner_user_id").notNull(),
});

describe("Drizzle data permission predicate translation", () => {
  it("executes parameterized allow-minus-deny predicates against SQLite", async () => {
    const client = createSqliteClient(":memory:");
    const db = drizzle(client);
    client.exec(
      "CREATE TABLE permission_records (id INTEGER PRIMARY KEY, organization_id TEXT NOT NULL, owner_user_id TEXT NOT NULL)",
    );
    await db.insert(records).values([
      { id: 1, organizationId: "10", ownerUserId: "7" },
      { id: 2, organizationId: "11", ownerUserId: "8" },
      { id: 3, organizationId: "12", ownerUserId: "9" },
    ]);
    const predicate: NeutralDataPredicate = {
      type: "and",
      predicates: [
        { type: "in", field: "organizationId", values: ["10", "11"] },
        {
          type: "not",
          predicate: { type: "equal", field: "ownerUserId", value: "8" },
        },
      ],
    };

    const result = await db
      .select()
      .from(records)
      .where(
        toDrizzleDataPredicate(predicate, {
          organizationId: records.organizationId,
          ownerUserId: records.ownerUserId,
        }),
      );

    expect(result.map(({ id }) => Number(id))).toEqual([1]);
    client.close();
  });

  it("rejects predicates that reference an unmapped database field", () => {
    expect(() =>
      toDrizzleDataPredicate(
        { type: "equal", field: "undeclared", value: "7" },
        { ownerUserId: records.ownerUserId },
      ),
    ).toThrow(/undeclared/);
  });

  it("enforces compiled allow-minus-deny rules in a Drizzle query", async () => {
    const client = createSqliteClient(":memory:");
    const db = drizzle(client);
    const enforcer = createBusinessPermissionEnforcer({
      definitions: [businessPermissionFixture],
    });
    client.exec(
      "CREATE TABLE permission_records (id INTEGER PRIMARY KEY, organization_id TEXT NOT NULL, owner_user_id TEXT NOT NULL)",
    );
    await db.insert(records).values([
      { id: 1, organizationId: "10", ownerUserId: "7" },
      { id: 2, organizationId: "11", ownerUserId: "8" },
      { id: 3, organizationId: "12", ownerUserId: "9" },
    ]);
    const predicate = enforcer.compileDataPredicate({
      resourceType: "fixture-permissions.record",
      context: {
        userId: "7",
        organizationId: "10",
        permissionCodes: ["fixture-permissions.record:data"],
        organizationDescendantIds: ["10", "11"],
        roleIds: ["2"],
        userIdsByRoleId: {},
        isSuperAdministrator: false,
      },
      rules: [
        {
          permissionCode: "fixture-permissions.record:data",
          effect: "allow",
          rule: {
            version: 1,
            resourceType: "fixture-permissions.record",
            expression: {
              type: "condition",
              operatorCode: "base.current-organization-descendants",
              arguments: {},
            },
          },
        },
        {
          permissionCode: "fixture-permissions.record:data",
          effect: "deny",
          rule: {
            version: 1,
            resourceType: "fixture-permissions.record",
            expression: {
              type: "condition",
              operatorCode: "base.specified-users",
              arguments: { userIds: ["8"] },
            },
          },
        },
      ],
    });

    const result = await db
      .select()
      .from(records)
      .where(
        toDrizzleDataPredicate(predicate, {
          organizationId: records.organizationId,
          ownerUserId: records.ownerUserId,
        }),
      );

    expect(result.map(({ id }) => Number(id))).toEqual([1]);
    client.close();
  });
});
