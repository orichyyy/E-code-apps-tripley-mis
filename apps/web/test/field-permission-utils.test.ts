import { describe, expect, it } from "vitest";

import {
  isBusinessFieldVisible,
  isBusinessFieldWritable,
  resolveFieldPermissionEffect,
} from "../src/features/permissions/field-permission-utils";

const rules = [
  {
    resource: "fixture-orders.order",
    field: "amount",
    scenario: "edit" as const,
    effect: "readonly" as const,
  },
  {
    resource: "fixture-orders.order",
    field: "amount",
    scenario: "edit" as const,
    effect: "hidden" as const,
  },
];

describe("Business Module field permission helpers", () => {
  it("uses the strongest matching scenario rule and defaults to visible", () => {
    expect(
      resolveFieldPermissionEffect({
        resource: "fixture-orders.order",
        field: "amount",
        scenario: "edit",
        rules,
      }),
    ).toBe("hidden");
    expect(
      resolveFieldPermissionEffect({
        resource: "fixture-orders.order",
        field: "amount",
        scenario: "detail",
        rules,
      }),
    ).toBe("visible");
  });

  it("distinguishes visibility from writability and bypasses rules for super administrators", () => {
    const readonlyRules = [{ ...rules[0]!, effect: "readonly" as const }];
    const input = {
      resource: "fixture-orders.order",
      field: "amount",
      scenario: "edit" as const,
      rules: readonlyRules,
    };

    expect(isBusinessFieldVisible(input)).toBe(true);
    expect(isBusinessFieldWritable(input)).toBe(false);
    expect(isBusinessFieldWritable({ ...input, isSuperAdministrator: true })).toBe(true);
  });
});
