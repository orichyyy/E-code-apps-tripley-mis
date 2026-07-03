import type { HonoRpcClientContract } from "@web-admin-base/contracts";

export const internalApiClient = {
  basePath: "/api"
} satisfies HonoRpcClientContract;

export async function requestJson<T>(endpoint: string, init: RequestInit = {}): Promise<T> {
  const token = typeof localStorage === "undefined" ? null : localStorage.getItem("web-admin.access-token");
  const response = await fetch(`${internalApiClient.basePath}${endpoint}`, {
    ...init,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers
    }
  });
  if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
  return (await response.json()) as T;
}

export function unwrapRecords(data: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(data)) return data.filter(isRecord);
  if (isRecord(data) && Array.isArray(data.items)) return data.items.filter(isRecord);
  return [];
}

export function stringField(value: unknown, fallback: string): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
