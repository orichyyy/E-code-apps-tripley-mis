import type { NeutralDataPredicate } from "@web-admin-base/contracts";
import { and, eq, inArray, not, or, sql, type AnyColumn, type SQL } from "drizzle-orm";

export type DrizzleDataPermissionColumns = Record<string, AnyColumn>;

export class DataPermissionColumnMappingError extends Error {
  constructor(field: string) {
    super(`No Drizzle column mapping was provided for data permission field ${field}.`);
    this.name = "DataPermissionColumnMappingError";
  }
}

export function toDrizzleDataPredicate(
  predicate: NeutralDataPredicate,
  columns: DrizzleDataPermissionColumns,
): SQL {
  if (predicate.type === "true") return sql`1 = 1`;
  if (predicate.type === "false") return sql`1 = 0`;
  if (predicate.type === "and") {
    return and(...predicate.predicates.map((item) => toDrizzleDataPredicate(item, columns)))!;
  }
  if (predicate.type === "or") {
    return or(...predicate.predicates.map((item) => toDrizzleDataPredicate(item, columns)))!;
  }
  if (predicate.type === "not") {
    return not(toDrizzleDataPredicate(predicate.predicate, columns));
  }
  const column = columns[predicate.field];
  if (!column) throw new DataPermissionColumnMappingError(predicate.field);
  if (predicate.type === "equal") return eq(column, predicate.value);
  return predicate.values.length === 0 ? sql`1 = 0` : inArray(column, predicate.values);
}
