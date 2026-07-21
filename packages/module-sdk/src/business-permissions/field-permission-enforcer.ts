import type { BusinessModuleDefinition, FieldPermissionScenario } from "@web-admin-base/contracts";

import type { EffectiveFieldPermissionRule } from "./types";

export class BusinessFieldPermissionError extends Error {
  readonly code = "AUTHORIZATION_FIELD_FORBIDDEN";

  constructor(readonly fields: string[]) {
    super("One or more fields are not writable in this permission context.");
    this.name = "BusinessFieldPermissionError";
  }
}

export class FieldPermissionEnforcer {
  private readonly controlledFields = new Map<string, Map<string, Set<FieldPermissionScenario>>>();

  constructor(definitions: BusinessModuleDefinition[]) {
    for (const definition of definitions) {
      for (const field of definition.contributions.fields) {
        const resource = this.controlledFields.get(field.resourceType) ?? new Map();
        resource.set(field.field, new Set(field.scenarios));
        this.controlledFields.set(field.resourceType, resource);
      }
    }
  }

  filter(input: {
    resourceType: string;
    scenario: "list" | "detail";
    record: Record<string, unknown>;
    rules: EffectiveFieldPermissionRule[];
    isSuperAdministrator?: boolean;
  }): Record<string, unknown> {
    if (input.isSuperAdministrator) return { ...input.record };
    const hidden = this.fieldsWithEffect(input, "hidden");
    return Object.fromEntries(Object.entries(input.record).filter(([field]) => !hidden.has(field)));
  }

  assertWritable(input: {
    resourceType: string;
    scenario: "create" | "edit";
    values: Record<string, unknown>;
    rules: EffectiveFieldPermissionRule[];
    isSuperAdministrator?: boolean;
  }): void {
    if (input.isSuperAdministrator) return;
    const denied = new Set([
      ...this.fieldsWithEffect(input, "hidden"),
      ...this.fieldsWithEffect(input, "readonly"),
    ]);
    const rejected = Object.keys(input.values).filter((field) => denied.has(field));
    if (rejected.length > 0) throw new BusinessFieldPermissionError(rejected.sort());
  }

  private fieldsWithEffect(
    input: {
      resourceType: string;
      scenario: FieldPermissionScenario;
      rules: EffectiveFieldPermissionRule[];
    },
    effect: "hidden" | "readonly",
  ): Set<string> {
    const declared = this.controlledFields.get(input.resourceType);
    if (!declared) return new Set();
    const strengths = new Map<string, number>();
    for (const rule of input.rules) {
      if (rule.resource !== input.resourceType || rule.scenario !== input.scenario) continue;
      if (!declared.get(rule.field)?.has(input.scenario)) continue;
      strengths.set(rule.field, Math.max(strengths.get(rule.field) ?? 0, strength(rule.effect)));
    }
    const target = strength(effect);
    return new Set([...strengths].filter(([, value]) => value === target).map(([field]) => field));
  }
}

function strength(effect: EffectiveFieldPermissionRule["effect"]): number {
  return effect === "hidden" ? 3 : effect === "readonly" ? 2 : 1;
}
