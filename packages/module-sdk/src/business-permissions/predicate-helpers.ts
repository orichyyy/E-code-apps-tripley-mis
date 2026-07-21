import type { NeutralDataPredicate } from "@web-admin-base/contracts";

export function andPredicates(predicates: NeutralDataPredicate[]): NeutralDataPredicate {
  if (predicates.some((predicate) => predicate.type === "false")) return { type: "false" };
  const retained = predicates.filter((predicate) => predicate.type !== "true");
  if (retained.length === 0) return { type: "true" };
  return retained.length === 1 ? retained[0]! : { type: "and", predicates: retained };
}

export function orPredicates(predicates: NeutralDataPredicate[]): NeutralDataPredicate {
  if (predicates.some((predicate) => predicate.type === "true")) return { type: "true" };
  const retained = predicates.filter((predicate) => predicate.type !== "false");
  if (retained.length === 0) return { type: "false" };
  return retained.length === 1 ? retained[0]! : { type: "or", predicates: retained };
}

export function negatePredicate(predicate: NeutralDataPredicate): NeutralDataPredicate {
  if (predicate.type === "true") return { type: "false" };
  if (predicate.type === "false") return { type: "true" };
  return { type: "not", predicate };
}
