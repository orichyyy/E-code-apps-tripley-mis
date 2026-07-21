import type { FieldPermissionScenario } from "@web-admin-base/contracts";

export type EffectiveFieldPermissionRule = {
  resource: string;
  field: string;
  scenario: FieldPermissionScenario;
  effect: "visible" | "hidden" | "readonly";
};

export type FieldPermissionEffect = EffectiveFieldPermissionRule["effect"];

export function resolveFieldPermissionEffect(input: {
  resource: string;
  field: string;
  scenario: EffectiveFieldPermissionRule["scenario"];
  rules: EffectiveFieldPermissionRule[];
  isSuperAdministrator?: boolean;
}): FieldPermissionEffect {
  if (input.isSuperAdministrator) return "visible";
  return input.rules
    .filter(
      (rule) =>
        rule.resource === input.resource &&
        rule.field === input.field &&
        rule.scenario === input.scenario,
    )
    .reduce<FieldPermissionEffect>(strongerEffect, "visible");
}

export function isBusinessFieldVisible(
  input: Parameters<typeof resolveFieldPermissionEffect>[0],
): boolean {
  return resolveFieldPermissionEffect(input) !== "hidden";
}

export function isBusinessFieldWritable(
  input: Parameters<typeof resolveFieldPermissionEffect>[0],
): boolean {
  return resolveFieldPermissionEffect(input) === "visible";
}

function strongerEffect(
  current: FieldPermissionEffect,
  rule: EffectiveFieldPermissionRule,
): FieldPermissionEffect {
  return strength(rule.effect) > strength(current) ? rule.effect : current;
}

function strength(effect: FieldPermissionEffect): number {
  return effect === "hidden" ? 3 : effect === "readonly" ? 2 : 1;
}
