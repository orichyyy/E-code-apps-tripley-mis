import {
  baseDataPermissionOperatorCodes,
  dataPermissionRuleDocumentSchema,
  neutralDataPredicateSchema,
  type BusinessModuleDefinition,
  type DataPermissionExpression,
  type NeutralDataPredicate,
} from "@web-admin-base/contracts";

import { andPredicates, negatePredicate, orPredicates } from "./predicate-helpers";
import type {
  BusinessPermissionEnforcerOptions,
  DataPermissionExecutionContext,
  DataPermissionOperatorHandler,
  EffectiveDataPermissionRule,
} from "./types";

type DataResource = BusinessModuleDefinition["contributions"]["dataResources"][number];

export class DataPermissionCompiler {
  private readonly resources = new Map<string, DataResource>();
  private readonly handlers: Record<string, DataPermissionOperatorHandler>;

  constructor(options: BusinessPermissionEnforcerOptions) {
    for (const definition of options.definitions) {
      for (const resource of definition.contributions.dataResources) {
        this.resources.set(resource.resourceType, resource);
      }
    }
    this.handlers = options.operatorHandlers ?? {};
  }

  compile(input: {
    resourceType: string;
    context: DataPermissionExecutionContext;
    rules: EffectiveDataPermissionRule[];
  }): NeutralDataPredicate {
    const resource = this.resources.get(input.resourceType);
    if (!resource) return { type: "false" };
    if (input.context.isSuperAdministrator) return { type: "true" };
    if (!input.context.permissionCodes.includes(resource.permissionCode)) {
      return { type: "false" };
    }
    const relevant = input.rules.filter(
      ({ rule }) =>
        typeof rule === "object" &&
        rule !== null &&
        "resourceType" in rule &&
        rule.resourceType === resource.resourceType,
    );
    if (resource.accessModel === "global") {
      return relevant.length === 0 ? { type: "true" } : { type: "false" };
    }
    if (relevant.length === 0) return { type: "false" };

    const allow: NeutralDataPredicate[] = [];
    const deny: NeutralDataPredicate[] = [];
    for (const candidate of relevant) {
      const parsed = dataPermissionRuleDocumentSchema.safeParse(candidate.rule);
      if (!parsed.success || candidate.permissionCode !== resource.permissionCode) {
        return { type: "false" };
      }
      const predicate = this.compileExpression(parsed.data.expression, resource, input.context);
      if (predicate.type === "false") return { type: "false" };
      (candidate.effect === "allow" ? allow : deny).push(predicate);
    }
    if (allow.length === 0) return { type: "false" };
    return andPredicates([orPredicates(allow), negatePredicate(orPredicates(deny))]);
  }

  private compileExpression(
    expression: DataPermissionExpression,
    resource: DataResource,
    context: DataPermissionExecutionContext,
  ): NeutralDataPredicate {
    if (expression.type === "all") return { type: "true" };
    if (expression.type === "and") {
      return andPredicates(
        expression.expressions.map((item) => this.compileExpression(item, resource, context)),
      );
    }
    if (expression.type === "or") {
      return orPredicates(
        expression.expressions.map((item) => this.compileExpression(item, resource, context)),
      );
    }
    return this.compileCondition(expression, resource, context);
  }

  private compileCondition(
    condition: Extract<DataPermissionExpression, { type: "condition" }>,
    resource: DataResource,
    context: DataPermissionExecutionContext,
  ): NeutralDataPredicate {
    const base = compileBaseCondition(condition, resource, context);
    if (base) return this.validatePredicate(base, resource);
    if (!resource.operatorCodes.includes(condition.operatorCode)) return { type: "false" };
    const handler = this.handlers[condition.operatorCode];
    if (!handler) return { type: "false" };
    try {
      return this.validatePredicate(
        handler({ arguments: condition.arguments, context, resource }),
        resource,
      );
    } catch {
      return { type: "false" };
    }
  }

  private validatePredicate(
    predicate: NeutralDataPredicate,
    resource: DataResource,
  ): NeutralDataPredicate {
    const parsed = neutralDataPredicateSchema.safeParse(predicate);
    if (!parsed.success) return { type: "false" };
    const fields = new Set(resource.fields.map(({ code }) => code));
    return predicateFields(parsed.data).every((field) => fields.has(field))
      ? parsed.data
      : { type: "false" };
  }
}

function compileBaseCondition(
  condition: Extract<DataPermissionExpression, { type: "condition" }>,
  resource: DataResource,
  context: DataPermissionExecutionContext,
): NeutralDataPredicate | null {
  const code = condition.operatorCode;
  if (code === baseDataPermissionOperatorCodes.currentUser) {
    return noArguments(condition.arguments) && resource.ownerUserField
      ? { type: "equal", field: resource.ownerUserField, value: context.userId }
      : { type: "false" };
  }
  if (code === baseDataPermissionOperatorCodes.currentOrganization) {
    return noArguments(condition.arguments) && resource.organizationField
      ? { type: "equal", field: resource.organizationField, value: context.organizationId }
      : { type: "false" };
  }
  if (code === baseDataPermissionOperatorCodes.currentOrganizationDescendants) {
    return noArguments(condition.arguments) && resource.organizationField
      ? {
          type: "in",
          field: resource.organizationField,
          values: context.organizationDescendantIds,
        }
      : { type: "false" };
  }
  if (code === baseDataPermissionOperatorCodes.specifiedOrganizations) {
    return idListPredicate(condition.arguments, "organizationIds", resource.organizationField);
  }
  if (code === baseDataPermissionOperatorCodes.specifiedUsers) {
    return idListPredicate(condition.arguments, "userIds", resource.ownerUserField);
  }
  if (code === baseDataPermissionOperatorCodes.specifiedRoles) {
    const roleIds = readIdList(condition.arguments, "roleIds");
    if (!roleIds || !resource.ownerUserField) return { type: "false" };
    const userIds = [
      ...new Set(roleIds.flatMap((roleId) => context.userIdsByRoleId[roleId] ?? [])),
    ];
    return { type: "in", field: resource.ownerUserField, values: userIds };
  }
  return null;
}

function idListPredicate(
  values: Record<string, unknown>,
  key: string,
  field: string | undefined,
): NeutralDataPredicate {
  const ids = readIdList(values, key);
  return ids && field ? { type: "in", field, values: ids } : { type: "false" };
}

function readIdList(values: Record<string, unknown>, key: string): string[] | null {
  if (Object.keys(values).length !== 1 || !Array.isArray(values[key])) return null;
  const ids = values[key];
  return ids.every((id) => typeof id === "string" && /^\d+$/.test(id)) ? ids : null;
}

function noArguments(values: Record<string, unknown>): boolean {
  return Object.keys(values).length === 0;
}

function predicateFields(predicate: NeutralDataPredicate): string[] {
  if (predicate.type === "equal" || predicate.type === "in") return [predicate.field];
  if (predicate.type === "and" || predicate.type === "or") {
    return predicate.predicates.flatMap(predicateFields);
  }
  return predicate.type === "not" ? predicateFields(predicate.predicate) : [];
}
