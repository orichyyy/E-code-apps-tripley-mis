import { internalApiClient, requestJson, stringField, unwrapRecords } from "./api-request";

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
    source: "typed-placeholder",
  },
  {
    id: "2",
    name: "Default Role",
    code: "default",
    status: "enabled",
    owner: "System",
    updatedAt: "2026-07-03T00:00:00Z",
    source: "typed-placeholder",
  },
];

const liveCoreRoutePrefixes = [
  "system.users",
  "system.organizations",
  "system.roles",
  "system.permissions",
  "system.menus",
  "operations.online-users",
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
      source: mode,
    })),
  };
}

const routeEndpointByCode: Record<string, string> = {
  "operations.online-users": "/online-users",
  "operations.scheduler": "/scheduled-tasks",
  "operations.import-export": "/import-export/tasks",
  "system.users": "/users",
  "system.organizations": "/organizations/tree",
  "system.roles": "/roles",
  "system.permissions": "/permissions",
  "system.menus": "/menus/tree",
  "system.config": "/system-config",
  "system.dictionaries": "/dictionary-types",
  "system.i18nMessages": "/i18n/messages",
  "system.files": "/files",
  "notifications.announcements": "/announcements",
  "notifications.templates": "/notification-templates",
  "notifications.webhooks": "/webhooks",
  "notifications.in-app": "/notifications",
  "logs.login": "/logs/login",
  "logs.operation": "/logs/operation",
  "logs.access": "/logs/access",
  "logs.api": "/logs/api",
  "logs.exception": "/logs/exception",
  "logs.security": "/logs/security",
  "logs.scheduler": "/logs/jobs",
  "logs.files": "/logs/files",
};

async function fetchLiveDataset(routeCode: string, endpoint: string): Promise<PageDataset | null> {
  const token =
    typeof localStorage === "undefined" ? null : localStorage.getItem("web-admin.access-token");
  if (!token) return null;

  try {
    const response = await fetch(`${internalApiClient.basePath}${endpoint}`, {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) return null;
    const envelope = (await response.json()) as { data?: unknown };
    return {
      mode: "available-api",
      hiddenFields: [],
      records: toRecords(routeCode, unwrapRecords(envelope.data)),
    };
  } catch {
    return null;
  }
}

function toRecords(routeCode: string, records: Array<Record<string, unknown>>): TableRecord[] {
  return records.map((record, index) => ({
    id: stringField(record.id, `${routeCode}-${index + 1}`),
    name: displayName(routeCode, record),
    code: stringField(
      record.code ??
        record.configKey ??
        record.itemValue ??
        record.messageKey ??
        record.logType ??
        record.resourceType ??
        record.channel,
      routeCode,
    ),
    status: stringField(record.status ?? record.level ?? record.enabled, "active"),
    owner: stringField(
      record.owner ?? record.userId ?? record.createdBy ?? record.handlerType,
      "System",
    ),
    updatedAt: stringField(record.updatedAt ?? record.createdAt ?? record.occurredAt, ""),
    source: "available-api",
    ...Object.fromEntries(
      Object.entries(record)
        .filter(([, value]) => typeof value === "string")
        .map(([key, value]) => [key, value]),
    ),
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
    routeCode,
  );
}

export async function loginWithPassword(input: { username: string; password: string }) {
  const envelope = await requestJson<{ data: LoginResponseData }>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const data = envelope.data;
  const preferences = isRecord(data.preferences) ? data.preferences : {};

  return {
    accessToken: data.accessToken,
    user: {
      id: stringField(data.user.id, ""),
      username: stringField(data.user.username, input.username),
      displayName: stringField(
        data.user.displayName,
        stringField(data.user.username, input.username),
      ),
      language: readLanguage(preferences.language),
      forcePasswordChange: Boolean(data.passwordChangeRequired),
    },
    permissionCodes: Array.isArray(data.permissionCodes)
      ? data.permissionCodes.filter((code): code is string => typeof code === "string")
      : [],
    currentOrganizationId: stringField(data.currentOrganization?.id, ""),
    organizations: Array.isArray(data.organizations)
      ? data.organizations.map(toSelectableOrganization).filter((item) => item.id.length > 0)
      : [],
  };
}

export async function changeOwnPassword(input: { oldPassword: string; newPassword: string }) {
  return requestJson<{ data: unknown }>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function switchCurrentOrganization(organizationId: string) {
  const envelope = await requestJson<{ data: SwitchOrganizationResponseData }>(
    "/context/current-organization",
    {
      method: "POST",
      body: JSON.stringify({ organizationId }),
    },
  );
  return {
    accessToken: envelope.data.accessToken,
    currentOrganizationId: stringField(envelope.data.currentOrganization?.id, organizationId),
    permissionCodes: Array.isArray(envelope.data.permissionCodes)
      ? envelope.data.permissionCodes.filter((code): code is string => typeof code === "string")
      : [],
  };
}

type LoginResponseData = {
  accessToken: string;
  user: Record<string, unknown>;
  passwordChangeRequired?: boolean;
  permissionCodes?: unknown[];
  preferences?: unknown;
  currentOrganization?: Record<string, unknown>;
  organizations?: Array<Record<string, unknown>>;
};

type SwitchOrganizationResponseData = {
  accessToken: string;
  currentOrganization?: Record<string, unknown>;
  permissionCodes?: unknown[];
};

function readLanguage(value: unknown): "en" | "zh" {
  return value === "zh" ? "zh" : "en";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toSelectableOrganization(record: Record<string, unknown>) {
  return {
    id: stringField(record.id, ""),
    name: stringField(record.name, ""),
    code: stringField(record.code, ""),
    status: record.status === "disabled" ? ("disabled" as const) : ("enabled" as const),
  };
}
