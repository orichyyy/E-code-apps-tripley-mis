import type { NeutralDataPredicate } from "@web-admin-base/contracts";

import { DataPermissionCompiler } from "./data-permission-compiler";
import { FieldPermissionEnforcer } from "./field-permission-enforcer";
import type {
  BusinessPermissionEnforcerOptions,
  DataPermissionExecutionContext,
  EffectiveDataPermissionRule,
  EffectiveFieldPermissionRule,
} from "./types";

export class BusinessPermissionEnforcer {
  private readonly data: DataPermissionCompiler;
  private readonly fields: FieldPermissionEnforcer;

  constructor(options: BusinessPermissionEnforcerOptions) {
    this.data = new DataPermissionCompiler(options);
    this.fields = new FieldPermissionEnforcer(options.definitions);
  }

  compileDataPredicate(input: {
    resourceType: string;
    context: DataPermissionExecutionContext;
    rules: EffectiveDataPermissionRule[];
  }): NeutralDataPredicate {
    return this.data.compile(input);
  }

  filterResponseFields(input: {
    resourceType: string;
    scenario: "list" | "detail";
    record: Record<string, unknown>;
    rules: EffectiveFieldPermissionRule[];
    isSuperAdministrator?: boolean;
  }): Record<string, unknown> {
    return this.fields.filter(input);
  }

  assertWritableFields(input: {
    resourceType: string;
    scenario: "create" | "edit";
    values: Record<string, unknown>;
    rules: EffectiveFieldPermissionRule[];
    isSuperAdministrator?: boolean;
  }): void {
    this.fields.assertWritable(input);
  }
}

export function createBusinessPermissionEnforcer(
  options: BusinessPermissionEnforcerOptions,
): BusinessPermissionEnforcer {
  return new BusinessPermissionEnforcer(options);
}
