import { createHash } from "node:crypto";

import type { EmailNotificationRequest } from "@web-admin-base/contracts";

import { renderNotificationTemplate } from "./notification-template-renderer";

type FingerprintInput = Omit<EmailNotificationRequest, "requestKey">;

export function createEmailRequestFingerprint(input: FingerprintInput): string {
  return createHash("sha256").update(canonicalJson(input)).digest("hex");
}

export function renderStrictEmailTemplate(
  subjectTemplate: string,
  bodyTemplate: string,
  declaredVariables: string[],
  variables: EmailNotificationRequest["variables"],
): { subject: string; body: string } {
  const declared = uniqueSorted(declaredVariables);
  const used = uniqueSorted([
    ...extractTemplateVariables(subjectTemplate),
    ...extractTemplateVariables(bodyTemplate),
  ]);
  if (!sameValues(declared, used)) {
    throw new Error("Template declarations do not match the placeholders used by the template.");
  }
  const supplied = uniqueSorted(Object.keys(variables));
  if (!sameValues(declared, supplied)) {
    throw new Error("Template variables do not match the declared variable contract.");
  }
  return {
    subject: renderNotificationTemplate(subjectTemplate, variables),
    body: renderNotificationTemplate(bodyTemplate, variables),
  };
}

export function assertNotificationTemplateContract(input: {
  subject?: string | null;
  body: string;
  variables: string[];
}): void {
  if (new Set(input.variables).size !== input.variables.length) {
    throw new Error("Template variable declarations must be unique.");
  }
  const declared = uniqueSorted(input.variables);
  const used = uniqueSorted([
    ...extractTemplateVariables(input.subject ?? ""),
    ...extractTemplateVariables(input.body),
  ]);
  if (!sameValues(declared, used)) {
    throw new Error("Template declarations do not match the placeholders used by the template.");
  }
}

export function maskEmailAddress(value: string): string {
  const separator = value.lastIndexOf("@");
  if (separator <= 0) return "***";
  const local = value.slice(0, separator);
  const domain = value.slice(separator + 1);
  const maskedLocal = local.length <= 2 ? `${local[0] ?? "*"}***` : `${local[0]}***${local.at(-1)}`;
  return `${maskedLocal}@${domain}`;
}

export function createStableMessageId(deliveryToken: string): string {
  return `<email-${deliveryToken}@web-admin-base.local>`;
}

function extractTemplateVariables(value: string): string[] {
  const result: string[] = [];
  const pattern = /\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}|\{\s*([A-Za-z0-9_.-]+)\s*\}/g;
  for (const match of value.matchAll(pattern)) result.push(String(match[1] ?? match[2]));
  return result;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function sameValues(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
