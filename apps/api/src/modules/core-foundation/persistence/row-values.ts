import type { DatabaseDialect } from "@web-admin-base/db";
import {
  dataPermissionRuleDocumentSchema,
  type DataPermissionRuleDocument,
} from "@web-admin-base/contracts";

import type {
  ApiPermissionRecord,
  AuthSessionRecord,
  FieldPermissionRuleRecord,
  InitializationStateRecord,
  PermissionRecord,
  RoleDataPermissionRecord,
  RolePermissionRecord,
  UserPreferenceRecord,
} from "../domain";
import type { InMemoryBackendStore } from "../in-memory-store";

export function placeholders(count: number, dialect: DatabaseDialect): string {
  return Array.from({ length: count }, (_, index) =>
    dialect === "postgresql" ? `$${index + 1}` : "?",
  ).join(", ");
}

export function normalizeParam(value: unknown, dialect: DatabaseDialect): unknown {
  if (typeof value === "boolean") return dialect === "sqlite" ? Number(value) : value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  return value;
}

export function jsonValue(value: unknown): unknown {
  return JSON.stringify(value);
}

export function id(value: unknown): string {
  if (value === null || value === undefined) throw new Error("Expected database id.");
  return String(value);
}

export function nullableId(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

export function stringValue(value: unknown): string {
  if (typeof value !== "string") return String(value);
  return value;
}

export function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : stringValue(value);
}

export function numberValue(value: unknown): number {
  return Number(value);
}

export function bigint(value: unknown): bigint {
  return typeof value === "bigint" ? value : BigInt(String(value));
}

export function booleanValue(value: unknown): boolean {
  return value === true || value === 1 || value === 1n;
}

export function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return stringValue(value);
}

export function nullableIso(value: unknown): string | null {
  return value === null || value === undefined ? null : iso(value);
}

export function jsonRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  if (typeof value === "string") return JSON.parse(value) as Record<string, unknown>;
  return {};
}

export function dataPermissionRule(value: unknown): DataPermissionRuleDocument {
  return dataPermissionRuleDocumentSchema.parse(jsonRecord(value));
}

export function fieldPermissionScenario(value: unknown): FieldPermissionRuleRecord["scenario"] {
  if (value === "list" || value === "create" || value === "edit") return value;
  return "detail";
}

export function entityStatus(value: unknown): "enabled" | "disabled" {
  return value === "disabled" ? "disabled" : "enabled";
}

export function userStatus(value: unknown): "enabled" | "disabled" | "locked" {
  return value === "disabled" || value === "locked" ? value : "enabled";
}

export function authSessionStatus(value: unknown): AuthSessionRecord["status"] {
  return value === "revoked" || value === "expired" ? value : "active";
}

export function permissionType(value: unknown): PermissionRecord["permissionType"] {
  if (["menu", "page", "action", "api", "data", "field"].includes(String(value))) {
    return String(value) as PermissionRecord["permissionType"];
  }
  return "action";
}

export function logLevel(value: unknown): ApiPermissionRecord["logLevel"] {
  if (["none", "basic", "request", "request_response"].includes(String(value))) {
    return String(value) as ApiPermissionRecord["logLevel"];
  }
  return "basic";
}

export function rolePermissionEffect(value: unknown): RolePermissionRecord["effect"] {
  return value === "deny" ? "deny" : "allow";
}

export function dataPermissionEffect(value: unknown): RoleDataPermissionRecord["effect"] {
  return value === "deny" ? "deny" : "allow";
}

export function fieldPermissionEffect(value: unknown): FieldPermissionRuleRecord["effect"] {
  if (value === "hidden" || value === "readonly") return value;
  return "visible";
}

export function userPreferenceLanguage(value: unknown): UserPreferenceRecord["language"] {
  return value === "zh" ? "zh" : "en";
}

export function userPreferenceThemeMode(value: unknown): UserPreferenceRecord["themeMode"] {
  return value === "dark" ? "dark" : "light";
}

export function userPreferenceThemeColor(value: unknown): UserPreferenceRecord["themeColor"] {
  if (value === "emerald" || value === "violet" || value === "slate") return value;
  return "blue";
}

export function initializationStatus(value: unknown): InitializationStateRecord["status"] {
  return value === "initialized" ? "initialized" : "uninitialized";
}

export function setSequence(
  store: InMemoryBackendStore,
  sequence: Parameters<InMemoryBackendStore["setSequenceValue"]>[0],
  records: Map<string, { id: string }>,
): void {
  const maxId = Math.max(0, ...[...records.values()].map((record) => Number(record.id)));
  store.setSequenceValue(sequence, maxId);
}
