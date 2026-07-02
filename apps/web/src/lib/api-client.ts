import type { HonoRpcClientContract } from "@web-admin-base/contracts";

export const internalApiClient = {
  basePath: "/api"
} satisfies HonoRpcClientContract;

export type ApiMode = "available-api" | "typed-placeholder";

export type TableRecord = {
  id: string;
  name: string;
  code: string;
  status: string;
  owner: string;
  updatedAt: string;
  source: ApiMode;
  [key: string]: string;
};

export type PageDataset = {
  records: TableRecord[];
  mode: ApiMode;
  hiddenFields: string[];
};

const baseRecords: TableRecord[] = [
  {
    id: "1",
    name: "Main Organization",
    code: "main",
    status: "enabled",
    owner: "Super Administrator",
    updatedAt: "2026-07-03T00:00:00Z",
    source: "typed-placeholder"
  },
  {
    id: "2",
    name: "Default Role",
    code: "default",
    status: "enabled",
    owner: "System",
    updatedAt: "2026-07-03T00:00:00Z",
    source: "typed-placeholder"
  }
];

const liveCoreRoutePrefixes = [
  "system.users",
  "system.organizations",
  "system.roles",
  "system.permissions",
  "system.menus",
  "operations.online-users"
];

export async function fetchPageDataset(routeCode: string): Promise<PageDataset> {
  await new Promise((resolve) => window.setTimeout(resolve, 10));
  const mode: ApiMode = liveCoreRoutePrefixes.some((prefix) => routeCode.startsWith(prefix))
    ? "available-api"
    : "typed-placeholder";

  return {
    mode,
    hiddenFields: routeCode === "system.users" ? ["owner"] : [],
    records: baseRecords.map((record) => ({
      ...record,
      id: `${routeCode}-${record.id}`,
      name: routeCode.includes("logs") ? `${record.name} event` : record.name,
      code: `${routeCode}:${record.code}`,
      source: mode
    }))
  };
}

export async function loginWithPassword(input: { username: string; password: string }) {
  await new Promise((resolve) => window.setTimeout(resolve, 10));
  return {
    accessToken: `local-demo-token-${input.username}`,
    user: {
      id: "1",
      username: input.username,
      displayName: input.username === "admin" ? "Super Administrator" : input.username,
      language: "en" as const,
      forcePasswordChange: input.password === "ChangeMe123"
    },
    permissionCodes: ["*"]
  };
}

export async function changeOwnPassword() {
  await new Promise((resolve) => window.setTimeout(resolve, 10));
  return { ok: true };
}
