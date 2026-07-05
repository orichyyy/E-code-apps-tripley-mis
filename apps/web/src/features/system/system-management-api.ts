import type {
  CreateDictionaryItemRequest,
  CreateDictionaryTypeRequest,
  UpdateDictionaryItemRequest,
  UpdateDictionaryTypeRequest,
  UpdateSystemConfigRequest,
} from "@web-admin-base/contracts";

import { requestJson, unwrapRecords } from "@/lib/api-request";
import {
  booleanValue,
  nullableString,
  numberValue,
  stringValue,
} from "@/features/operations/record-utils";

type ConfigValue = string | number | boolean | Record<string, unknown> | unknown[];

export type SystemConfig = {
  id: string;
  tenantId: string | null;
  configKey: string;
  configValue: ConfigValue;
  valueType: "string" | "number" | "boolean" | "json";
  groupKey: string;
  description: string | null;
  editable: boolean;
  status: "enabled" | "disabled" | string;
  updatedAt: string;
};

export type DictionaryType = {
  id: string;
  tenantId: string | null;
  code: string;
  name: string;
  description: string | null;
  status: "enabled" | "disabled" | string;
};

export type DictionaryItem = {
  id: string;
  tenantId: string | null;
  typeId: string;
  itemValue: string;
  labelI18nKey: string;
  sortOrder: number;
  status: "enabled" | "disabled" | string;
};

export async function fetchSystemConfigs(): Promise<SystemConfig[]> {
  const envelope = await requestJson<{ data: unknown }>("/system-config");
  return unwrapRecords(envelope.data).map(toSystemConfig);
}

export async function updateSystemConfig(configKey: string, input: UpdateSystemConfigRequest) {
  return requestJson<{ data: SystemConfig | null }>(
    `/system-config/${encodeURIComponent(configKey)}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export async function fetchDictionaryTypes(): Promise<DictionaryType[]> {
  const envelope = await requestJson<{ data: unknown }>("/dictionary-types");
  return unwrapRecords(envelope.data).map(toDictionaryType);
}

export async function createDictionaryType(input: CreateDictionaryTypeRequest) {
  return requestJson<{ data: DictionaryType }>("/dictionary-types", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateDictionaryType(id: string, input: UpdateDictionaryTypeRequest) {
  return requestJson<{ data: DictionaryType | null }>(`/dictionary-types/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function fetchDictionaryItems(typeId: string): Promise<DictionaryItem[]> {
  const envelope = await requestJson<{ data: unknown }>(`/dictionary-types/${typeId}/items`);
  return unwrapRecords(envelope.data).map(toDictionaryItem);
}

export async function createDictionaryItem(typeId: string, input: CreateDictionaryItemRequest) {
  return requestJson<{ data: DictionaryItem }>(`/dictionary-types/${typeId}/items`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateDictionaryItem(id: string, input: UpdateDictionaryItemRequest) {
  return requestJson<{ data: DictionaryItem | null }>(`/dictionary-items/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

function toSystemConfig(record: Record<string, unknown>): SystemConfig {
  return {
    id: stringValue(record.id),
    tenantId: nullableString(record.tenantId),
    configKey: stringValue(record.configKey),
    configValue: record.configValue as ConfigValue,
    valueType: readValueType(record.valueType),
    groupKey: stringValue(record.groupKey),
    description: nullableString(record.description),
    editable: booleanValue(record.editable),
    status: stringValue(record.status, "enabled"),
    updatedAt: stringValue(record.updatedAt),
  };
}

function toDictionaryType(record: Record<string, unknown>): DictionaryType {
  return {
    id: stringValue(record.id),
    tenantId: nullableString(record.tenantId),
    code: stringValue(record.code),
    name: stringValue(record.name),
    description: nullableString(record.description),
    status: stringValue(record.status, "enabled"),
  };
}

function toDictionaryItem(record: Record<string, unknown>): DictionaryItem {
  return {
    id: stringValue(record.id),
    tenantId: nullableString(record.tenantId),
    typeId: stringValue(record.typeId),
    itemValue: stringValue(record.itemValue),
    labelI18nKey: stringValue(record.labelI18nKey),
    sortOrder: numberValue(record.sortOrder),
    status: stringValue(record.status, "enabled"),
  };
}

function readValueType(value: unknown): SystemConfig["valueType"] {
  return value === "number" || value === "boolean" || value === "json" ? value : "string";
}
