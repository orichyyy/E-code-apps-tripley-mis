import {
  dataPermissionRuleDocumentSchema,
  fieldPermissionScenarioSchema,
  neutralDataPredicateSchema,
  updateRoleDataPermissionsRequestSchema,
  updateRoleFieldPermissionsRequestSchema,
} from "../src";
import { describe, expect, it } from "vitest";

describe("Business Module executable permission contracts", () => {
  it("accepts versioned resource-aware rule documents", () => {
    expect(
      dataPermissionRuleDocumentSchema.parse({
        version: 1,
        resourceType: "fixture-orders.order",
        expression: {
          type: "and",
          expressions: [
            { type: "condition", operatorCode: "base.current-organization", arguments: {} },
            {
              type: "condition",
              operatorCode: "fixture-orders.minimum-total",
              arguments: { amount: 100 },
            },
          ],
        },
      }),
    ).toMatchObject({ version: 1, resourceType: "fixture-orders.order" });
  });

  it("rejects arbitrary rule and predicate shapes", () => {
    expect(
      dataPermissionRuleDocumentSchema.safeParse({
        version: 1,
        resourceType: "fixture-orders.order",
        expression: { type: "sql", value: "1 = 1" },
      }).success,
    ).toBe(false);
    expect(neutralDataPredicateSchema.safeParse({ type: "raw", sql: "owner_id = 1" }).success).toBe(
      false,
    );
  });

  it("defines the four field permission scenarios", () => {
    expect(fieldPermissionScenarioSchema.options).toEqual(["list", "detail", "create", "edit"]);
  });

  it("requires executable rule documents and field scenarios in role updates", () => {
    expect(
      updateRoleDataPermissionsRequestSchema.safeParse({
        rules: [
          {
            permissionCode: "base.user-data",
            effect: "allow",
            rule: { scope: "current_organization" },
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      updateRoleFieldPermissionsRequestSchema.safeParse({
        rules: [{ resource: "base.user", field: "email", effect: "hidden" }],
      }).success,
    ).toBe(false);
    expect(
      updateRoleFieldPermissionsRequestSchema.parse({
        rules: [{ resource: "base.user", field: "email", scenario: "detail", effect: "hidden" }],
      }),
    ).toEqual({
      rules: [{ resource: "base.user", field: "email", scenario: "detail", effect: "hidden" }],
    });
  });
});
