import type {
  BusinessModuleDefinition,
  DataPermissionOperatorHandler,
  DataPermissionRuleDocument,
  FieldPermissionScenario,
} from "@web-admin-base/contracts";

export type {
  DataPermissionExecutionContext,
  DataPermissionOperatorHandler,
} from "@web-admin-base/contracts";

export type EffectiveDataPermissionRule = {
  permissionCode: string;
  effect: "allow" | "deny";
  rule: DataPermissionRuleDocument;
};

export type EffectiveFieldPermissionRule = {
  resource: string;
  field: string;
  scenario: FieldPermissionScenario;
  effect: "visible" | "hidden" | "readonly";
};

export type BusinessPermissionEnforcerOptions = {
  definitions: BusinessModuleDefinition[];
  operatorHandlers?: Record<string, DataPermissionOperatorHandler>;
};
