import type {
  CreateWebhookSubscriptionRequest,
  HonoRpcClientContract,
  UpdateWebhookSubscriptionRequest
} from "@web-admin-base/contracts";

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

export type WebhookSubscription = {
  id: string;
  name: string;
  url: string;
  eventTypes: string[];
  secretConfigured: boolean;
  status: "enabled" | "disabled";
  createdAt: string;
  updatedAt: string;
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
  const endpoint = routeEndpointByCode[routeCode];
  if (endpoint) {
    const live = await fetchLiveDataset(routeCode, endpoint);
    if (live) return live;
  }

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

const routeEndpointByCode: Record<string, string> = {
  "operations.online-users": "/online-users",
  "operations.scheduler": "/scheduled-tasks",
  "operations.import-export": "/import-export/tasks",
  "system.config": "/system-config",
  "system.dictionaries": "/dictionary-types",
  "system.files": "/files",
  "notifications.announcements": "/announcements",
  "notifications.webhooks": "/webhooks",
  "notifications.in-app": "/notifications",
  "logs.login": "/logs/login",
  "logs.operation": "/logs/operation",
  "logs.access": "/logs/access",
  "logs.api": "/logs/api",
  "logs.exception": "/logs/exception",
  "logs.security": "/logs/security",
  "logs.scheduler": "/logs/jobs",
  "logs.files": "/logs/files"
};

async function fetchLiveDataset(routeCode: string, endpoint: string): Promise<PageDataset | null> {
  const token = typeof localStorage === "undefined" ? null : localStorage.getItem("web-admin.access-token");
  if (!token) return null;

  try {
    const response = await fetch(`${internalApiClient.basePath}${endpoint}`, {
      headers: {
        authorization: `Bearer ${token}`
      }
    });
    if (!response.ok) return null;
    const envelope = (await response.json()) as { data?: unknown };
    return {
      mode: "available-api",
      hiddenFields: [],
      records: toRecords(routeCode, unwrapRecords(envelope.data))
    };
  } catch {
    return null;
  }
}

function unwrapRecords(data: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(data)) return data.filter(isRecord);
  if (isRecord(data) && Array.isArray(data.items)) return data.items.filter(isRecord);
  return [];
}

function toRecords(routeCode: string, records: Array<Record<string, unknown>>): TableRecord[] {
  return records.map((record, index) => ({
    id: stringField(record.id, `${routeCode}-${index + 1}`),
    name: displayName(routeCode, record),
    code: stringField(
      record.code ?? record.configKey ?? record.itemValue ?? record.messageKey ?? record.logType ?? record.resourceType ?? record.channel,
      routeCode
    ),
    status: stringField(record.status ?? record.level ?? record.enabled, "active"),
    owner: stringField(record.owner ?? record.userId ?? record.createdBy ?? record.handlerType, "System"),
    updatedAt: stringField(record.updatedAt ?? record.createdAt ?? record.occurredAt, ""),
    source: "available-api",
    ...Object.fromEntries(
      Object.entries(record)
        .filter(([, value]) => typeof value === "string")
        .map(([key, value]) => [key, value])
    )
  }));
}

function displayName(routeCode: string, record: Record<string, unknown>): string {
  return stringField(
    record.name ??
      record.displayName ??
      record.originalName ??
      record.title ??
      record.message ??
      record.configKey ??
      record.itemValue ??
      record.messageKey ??
      record.code ??
      record.resourceType,
    routeCode
  );
}

function stringField(value: unknown, fallback: string): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

export async function fetchWebhookSubscriptions(): Promise<WebhookSubscription[]> {
  const envelope = await requestJson<{ data?: unknown }>("/webhooks");
  return unwrapRecords(envelope.data).map(toWebhookSubscription);
}

export async function createWebhookSubscription(input: CreateWebhookSubscriptionRequest) {
  return requestJson<{ data: WebhookSubscription }>("/webhooks", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function updateWebhookSubscription(id: string, input: UpdateWebhookSubscriptionRequest) {
  return requestJson<{ data: WebhookSubscription }>(`/webhooks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

async function requestJson<T>(endpoint: string, init: RequestInit = {}): Promise<T> {
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

function toWebhookSubscription(record: Record<string, unknown>): WebhookSubscription {
  return {
    id: stringField(record.id, ""),
    name: stringField(record.name, ""),
    url: stringField(record.url, ""),
    eventTypes: Array.isArray(record.eventTypes)
      ? record.eventTypes.filter((value): value is string => typeof value === "string")
      : [],
    secretConfigured: record.secretConfigured === true,
    status: record.status === "disabled" ? "disabled" : "enabled",
    createdAt: stringField(record.createdAt, ""),
    updatedAt: stringField(record.updatedAt, "")
  };
}
