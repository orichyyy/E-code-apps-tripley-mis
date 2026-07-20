import type { DataPermissionRuleDocument } from "@web-admin-base/contracts";
import { describe, expect, it } from "vitest";

import {
  BusinessFieldPermissionError,
  createBusinessPermissionEnforcer,
  defineBusinessModule,
} from "../src";

const definition = defineBusinessModule({
  contractVersion: 1,
  moduleCode: "fixture-orders",
  defaultLocale: "en",
  title: { key: "modules.fixture-orders.title", defaultMessage: "Orders" },
  contributions: {
    permissions: [
      {
        code: "fixture-orders.order:data",
        description: {
          key: "modules.fixture-orders.permissions.data",
          defaultMessage: "Access order data",
        },
        permissionType: "data",
      },
    ],
    dataResources: [
      {
        resourceType: "fixture-orders.order",
        permissionCode: "fixture-orders.order:data",
        title: { key: "modules.fixture-orders.resources.order", defaultMessage: "Order" },
        accessModel: "policy",
        fields: [
          {
            code: "organizationId",
            title: { key: "modules.fixture-orders.fields.organization", defaultMessage: "Org" },
            valueType: "id",
          },
          {
            code: "ownerUserId",
            title: { key: "modules.fixture-orders.fields.owner", defaultMessage: "Owner" },
            valueType: "id",
          },
          {
            code: "total",
            title: { key: "modules.fixture-orders.fields.total", defaultMessage: "Total" },
            valueType: "number",
          },
          {
            code: "secret",
            title: { key: "modules.fixture-orders.fields.secret", defaultMessage: "Secret" },
            valueType: "string",
          },
        ],
        ownerUserField: "ownerUserId",
        organizationField: "organizationId",
        operatorCodes: ["fixture-orders.minimum-total"],
      },
    ],
    fields: [
      {
        resourceType: "fixture-orders.order",
        field: "secret",
        title: { key: "modules.fixture-orders.fields.secret", defaultMessage: "Secret" },
        scenarios: ["list", "detail", "create", "edit"],
      },
    ],
  },
});

const context = {
  userId: "7",
  organizationId: "10",
  permissionCodes: ["fixture-orders.order:data"],
  organizationDescendantIds: ["10", "11"],
  roleIds: ["3"],
  userIdsByRoleId: { "3": ["7", "8"] },
  isSuperAdministrator: false,
};

describe("BusinessPermissionEnforcer", () => {
  it("combines allow rules and removes deny matches", () => {
    const enforcer = createBusinessPermissionEnforcer({ definitions: [definition] });
    const predicate = enforcer.compileDataPredicate({
      resourceType: "fixture-orders.order",
      context,
      rules: [
        rule("allow", {
          type: "condition",
          operatorCode: "base.current-organization-descendants",
          arguments: {},
        }),
        rule("deny", {
          type: "condition",
          operatorCode: "base.specified-users",
          arguments: { userIds: ["8"] },
        }),
      ],
    });

    expect(predicate).toEqual({
      type: "and",
      predicates: [
        { type: "in", field: "organizationId", values: ["10", "11"] },
        {
          type: "not",
          predicate: { type: "in", field: "ownerUserId", values: ["8"] },
        },
      ],
    });
  });

  it("fails closed without valid rules or custom operator handlers", () => {
    const enforcer = createBusinessPermissionEnforcer({ definitions: [definition] });
    expect(
      enforcer.compileDataPredicate({
        resourceType: "fixture-orders.order",
        context,
        rules: [],
      }),
    ).toEqual({ type: "false" });
    expect(
      enforcer.compileDataPredicate({
        resourceType: "fixture-orders.order",
        context,
        rules: [
          rule("allow", {
            type: "condition",
            operatorCode: "fixture-orders.minimum-total",
            arguments: { amount: 100 },
          }),
        ],
      }),
    ).toEqual({ type: "false" });
  });

  it("fails closed when a user override removes the resource data permission", () => {
    const enforcer = createBusinessPermissionEnforcer({ definitions: [definition] });

    expect(
      enforcer.compileDataPredicate({
        resourceType: "fixture-orders.order",
        context: { ...context, permissionCodes: [] },
        rules: [rule("allow", { type: "all" })],
      }),
    ).toEqual({ type: "false" });
  });

  it("validates custom predicates against declared resource fields", () => {
    const valid = createBusinessPermissionEnforcer({
      definitions: [definition],
      operatorHandlers: {
        "fixture-orders.minimum-total": ({ arguments: values }) => ({
          type: "equal",
          field: "total",
          value: Number(values.amount),
        }),
      },
    });
    const invalid = createBusinessPermissionEnforcer({
      definitions: [definition],
      operatorHandlers: {
        "fixture-orders.minimum-total": () => ({
          type: "equal",
          field: "undeclared",
          value: 1,
        }),
      },
    });

    expect(
      valid.compileDataPredicate({
        resourceType: "fixture-orders.order",
        context,
        rules: [
          rule("allow", {
            type: "condition",
            operatorCode: "fixture-orders.minimum-total",
            arguments: { amount: 100 },
          }),
        ],
      }),
    ).toEqual({ type: "equal", field: "total", value: 100 });
    expect(
      invalid.compileDataPredicate({
        resourceType: "fixture-orders.order",
        context,
        rules: [
          rule("allow", {
            type: "condition",
            operatorCode: "fixture-orders.minimum-total",
            arguments: {},
          }),
        ],
      }),
    ).toEqual({ type: "false" });
  });

  it("filters hidden response fields and rejects hidden or readonly writes by scenario", () => {
    const enforcer = createBusinessPermissionEnforcer({ definitions: [definition] });
    const rules = [
      {
        resource: "fixture-orders.order",
        field: "secret",
        scenario: "detail" as const,
        effect: "hidden" as const,
      },
      {
        resource: "fixture-orders.order",
        field: "secret",
        scenario: "edit" as const,
        effect: "readonly" as const,
      },
    ];

    expect(
      enforcer.filterResponseFields({
        resourceType: "fixture-orders.order",
        scenario: "detail",
        record: { id: "1", secret: "masked", total: 100 },
        rules,
      }),
    ).toEqual({ id: "1", total: 100 });
    expect(() =>
      enforcer.assertWritableFields({
        resourceType: "fixture-orders.order",
        scenario: "edit",
        values: { secret: "changed" },
        rules,
      }),
    ).toThrow(BusinessFieldPermissionError);
  });
});

function rule(effect: "allow" | "deny", expression: DataPermissionRuleDocument["expression"]) {
  return {
    permissionCode: "fixture-orders.order:data",
    effect,
    rule: { version: 1 as const, resourceType: "fixture-orders.order", expression },
  };
}
