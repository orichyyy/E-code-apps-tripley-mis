import { z } from "zod";

import { namespacedCodeSchema } from "../business-modules/common";
import type { DataResourceContribution } from "../business-modules/contributions";

export const baseDataPermissionOperatorCodes = {
  currentUser: "base.current-user",
  currentOrganization: "base.current-organization",
  currentOrganizationDescendants: "base.current-organization-descendants",
  specifiedOrganizations: "base.specified-organizations",
  specifiedUsers: "base.specified-users",
  specifiedRoles: "base.specified-roles",
} as const;

export const fieldPermissionScenarioSchema = z.enum(["list", "detail", "create", "edit"]);

export const dataPermissionArgumentValueSchema = z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
  z.array(z.string()),
  z.array(z.number().finite()),
  z.array(z.boolean()),
]);

export type DataPermissionExpression =
  | { type: "all" }
  | { type: "and"; expressions: DataPermissionExpression[] }
  | { type: "or"; expressions: DataPermissionExpression[] }
  | {
      type: "condition";
      operatorCode: string;
      arguments: Record<string, z.infer<typeof dataPermissionArgumentValueSchema>>;
    };

export const dataPermissionExpressionSchema: z.ZodType<DataPermissionExpression> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({ type: z.literal("all") }).strict(),
    z
      .object({
        type: z.literal("and"),
        expressions: z.array(dataPermissionExpressionSchema).min(1).max(20),
      })
      .strict(),
    z
      .object({
        type: z.literal("or"),
        expressions: z.array(dataPermissionExpressionSchema).min(1).max(20),
      })
      .strict(),
    z
      .object({
        type: z.literal("condition"),
        operatorCode: namespacedCodeSchema,
        arguments: z.record(z.string(), dataPermissionArgumentValueSchema),
      })
      .strict(),
  ]),
);

export const dataPermissionRuleDocumentSchema = z
  .object({
    version: z.literal(1),
    resourceType: namespacedCodeSchema,
    expression: dataPermissionExpressionSchema,
  })
  .strict();

export type NeutralDataPredicate =
  | { type: "true" }
  | { type: "false" }
  | { type: "and"; predicates: NeutralDataPredicate[] }
  | { type: "or"; predicates: NeutralDataPredicate[] }
  | { type: "not"; predicate: NeutralDataPredicate }
  | { type: "equal"; field: string; value: string | number | boolean }
  | { type: "in"; field: string; values: Array<string | number | boolean> };

const predicateScalarSchema = z.union([z.string(), z.number().finite(), z.boolean()]);

export const neutralDataPredicateSchema: z.ZodType<NeutralDataPredicate> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({ type: z.literal("true") }).strict(),
    z.object({ type: z.literal("false") }).strict(),
    z
      .object({
        type: z.literal("and"),
        predicates: z.array(neutralDataPredicateSchema).min(1).max(20),
      })
      .strict(),
    z
      .object({
        type: z.literal("or"),
        predicates: z.array(neutralDataPredicateSchema).min(1).max(20),
      })
      .strict(),
    z.object({ type: z.literal("not"), predicate: neutralDataPredicateSchema }).strict(),
    z
      .object({
        type: z.literal("equal"),
        field: z.string().regex(/^[a-z][a-zA-Z0-9]*$/),
        value: predicateScalarSchema,
      })
      .strict(),
    z
      .object({
        type: z.literal("in"),
        field: z.string().regex(/^[a-z][a-zA-Z0-9]*$/),
        values: z.array(predicateScalarSchema).max(500),
      })
      .strict(),
  ]),
);

export type FieldPermissionScenario = z.infer<typeof fieldPermissionScenarioSchema>;
export type DataPermissionArgumentValue = z.infer<typeof dataPermissionArgumentValueSchema>;
export type DataPermissionRuleDocument = z.infer<typeof dataPermissionRuleDocumentSchema>;

export type DataPermissionExecutionContext = {
  userId: string;
  organizationId: string;
  permissionCodes: string[];
  organizationDescendantIds: string[];
  roleIds: string[];
  userIdsByRoleId: Record<string, string[]>;
  isSuperAdministrator: boolean;
};

export type DataPermissionOperatorInput = {
  arguments: Record<string, DataPermissionArgumentValue>;
  context: DataPermissionExecutionContext;
  resource: DataResourceContribution;
};

export type DataPermissionOperatorHandler = (
  input: DataPermissionOperatorInput,
) => NeutralDataPredicate;
