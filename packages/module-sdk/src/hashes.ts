import { createHash } from "node:crypto";

import type { BusinessModuleDefinition } from "@web-admin-base/contracts";

import { canonicalJson } from "./canonical-json";

const presentationKeys = new Set([
  "defaultLocale",
  "defaultMessage",
  "description",
  "i18nMessages",
  "message",
  "sortOrder",
  "title",
  "translations",
]);

function activationProjection(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(activationProjection);
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !presentationKeys.has(key))
        .map(([key, child]) => [key, activationProjection(child)]),
    );
  }

  return value;
}

export function sha256(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function definitionHash(definition: BusinessModuleDefinition): string {
  return sha256(definition);
}

export function activationHash(definition: BusinessModuleDefinition): string {
  return sha256(activationProjection(definition));
}
