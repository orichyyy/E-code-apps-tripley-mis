import { z } from "zod";

import { stringField, unwrapRecords } from "@/lib/api-request";

export type CoreEntity = Record<string, unknown> & {
  id: string;
};

export type CorePageKind = "users" | "organizations" | "roles" | "permissions" | "menus";

export type CoreOption = {
  id: string;
  label: string;
  code?: string;
};

export type CoreField = {
  name: string;
  label: string;
  type?: "text" | "email" | "password" | "number" | "select" | "textarea" | "checkbox";
  required?: boolean;
  options?: CoreOption[];
};

export type CoreFormValues = Record<string, string | boolean>;

export const coreEntitySchema = z.object({ id: z.string().min(1) }).passthrough();

export function parseCoreEntities(data: unknown): CoreEntity[] {
  return unwrapRecords(data)
    .map((record) => ({ ...record, id: stringField(record.id, "") }))
    .filter((record) => record.id.length > 0);
}

export function flattenTree(data: unknown): CoreEntity[] {
  const records = parseCoreEntities(data);
  const result: CoreEntity[] = [];
  const visit = (record: CoreEntity, depth: number) => {
    result.push({ ...record, depth });
    const children = Array.isArray(record.children) ? record.children : [];
    for (const child of children) {
      const parsed = coreEntitySchema.safeParse(child);
      if (parsed.success) visit(parsed.data as CoreEntity, depth + 1);
    }
  };
  for (const record of records) visit(record, 0);
  return result;
}

export function toOption(record: CoreEntity, fallback: string): CoreOption {
  const label =
    stringField(record.displayName, "") ||
    stringField(record.name, "") ||
    stringField(record.titleI18nKey, "") ||
    stringField(record.code, fallback);
  return {
    id: record.id,
    label,
    code: stringField(record.code, ""),
  };
}

export function compactPayload(values: CoreFormValues): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(values)
      .filter(([, value]) => value !== "")
      .map(([key, value]) => [
        key,
        numericKey(key) && typeof value === "string" ? Number(value) : value,
      ]),
  );
}

export function displayValue(record: CoreEntity, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const value = stringField(record[key], "");
    if (value) return value;
  }
  return fallback;
}

function numericKey(key: string): boolean {
  return key.endsWith("Order") || key === "sortOrder";
}
