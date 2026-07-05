import {
  jsonParam,
  nowIso,
  readJson,
  type DatabaseAdapterExecutor,
  type DatabaseRow,
} from "@web-admin-base/adapters";
import { loadDatabaseConfig } from "@web-admin-base/db";
import type {
  CreateDictionaryItemRequest,
  CreateDictionaryTypeRequest,
  UpdateDictionaryItemRequest,
  UpdateDictionaryTypeRequest,
  UpdateI18nMessageRequest,
  UpdateSystemConfigRequest,
} from "@web-admin-base/contracts";

import {
  createPostgresqlInfrastructureExecutor,
  createSqliteInfrastructureExecutor,
} from "../infrastructure/infrastructure.executor";
import type {
  ConfigValue,
  DictionaryItemRecord,
  DictionaryTypeRecord,
  I18nMessageRecord,
  SystemConfigRecord,
} from "./system-management.types";

export class SystemManagementRepository {
  constructor(private readonly executor: DatabaseAdapterExecutor) {}

  static fromEnvironment(env: NodeJS.ProcessEnv = process.env): SystemManagementRepository {
    const config = loadDatabaseConfig(env);
    const executor =
      config.dialect === "postgresql"
        ? createPostgresqlInfrastructureExecutor(config.url)
        : createSqliteInfrastructureExecutor(config.url);
    return new SystemManagementRepository(executor);
  }

  close(): Promise<void> {
    return this.executor.close();
  }

  async listSystemConfigs(): Promise<SystemConfigRecord[]> {
    const rows = await this.executor.all(
      `SELECT id, tenant_id, config_key, config_value, value_type, group_key, description, editable, status, updated_at
       FROM system_configs ORDER BY group_key, config_key LIMIT 200`,
    );
    return rows.map(toSystemConfig);
  }

  async updateSystemConfig(
    key: string,
    input: UpdateSystemConfigRequest,
  ): Promise<SystemConfigRecord | null> {
    const current = (await this.listSystemConfigs()).find((record) => record.configKey === key);
    if (!current || !current.editable) return current ?? null;
    const valueType = inferValueType(input.configValue);
    await this.executor.run(
      `UPDATE system_configs
       SET config_value = ${this.p(1)}, value_type = ${this.p(2)}, updated_at = ${this.p(3)}
       WHERE config_key = ${this.p(4)}`,
      [jsonParam(input.configValue, this.executor.dialect), valueType, nowIso(), key],
    );
    return (await this.listSystemConfigs()).find((record) => record.configKey === key) ?? null;
  }

  async listDictionaryTypes(): Promise<DictionaryTypeRecord[]> {
    const rows = await this.executor.all(
      `SELECT id, tenant_id, code, name, description, status FROM dictionary_types ORDER BY code LIMIT 200`,
    );
    return rows.map(toDictionaryType);
  }

  async createDictionaryType(input: CreateDictionaryTypeRequest): Promise<DictionaryTypeRecord> {
    await this.executor.run(
      `INSERT INTO dictionary_types (code, name, description, status)
       VALUES (${this.p(1)}, ${this.p(2)}, ${this.p(3)}, ${this.p(4)})`,
      [input.code, input.name, input.description ?? null, input.status],
    );
    return (
      (await this.listDictionaryTypes()).find((record) => record.code === input.code) ??
      (await this.listDictionaryTypes())[0]
    );
  }

  async updateDictionaryType(
    id: string,
    input: UpdateDictionaryTypeRequest,
  ): Promise<DictionaryTypeRecord | null> {
    const current = (await this.listDictionaryTypes()).find((record) => record.id === id);
    if (!current) return null;
    const next = { ...current, ...input };
    await this.executor.run(
      `UPDATE dictionary_types
       SET code = ${this.p(1)}, name = ${this.p(2)}, description = ${this.p(3)}, status = ${this.p(4)}
       WHERE id = ${this.p(5)}`,
      [next.code, next.name, next.description ?? null, next.status, id],
    );
    return (await this.listDictionaryTypes()).find((record) => record.id === id) ?? null;
  }

  async listDictionaryItems(typeId: string): Promise<DictionaryItemRecord[]> {
    const rows = await this.executor.all(
      `SELECT id, tenant_id, type_id, item_value, label_i18n_key, sort_order, status
       FROM dictionary_items WHERE type_id = ${this.p(1)} ORDER BY sort_order, item_value LIMIT 200`,
      [typeId],
    );
    return rows.map(toDictionaryItem);
  }

  async createDictionaryItem(
    typeId: string,
    input: CreateDictionaryItemRequest,
  ): Promise<DictionaryItemRecord> {
    await this.executor.run(
      `INSERT INTO dictionary_items (type_id, item_value, label_i18n_key, sort_order, status)
       VALUES (${this.p(1)}, ${this.p(2)}, ${this.p(3)}, ${this.p(4)}, ${this.p(5)})`,
      [typeId, input.itemValue, input.labelI18nKey, input.sortOrder, input.status],
    );
    return (
      (await this.listDictionaryItems(typeId)).find(
        (record) => record.itemValue === input.itemValue,
      ) ?? (await this.listDictionaryItems(typeId))[0]
    );
  }

  async updateDictionaryItem(
    id: string,
    input: UpdateDictionaryItemRequest,
  ): Promise<DictionaryItemRecord | null> {
    const current = await this.getDictionaryItem(id);
    if (!current) return null;
    const next = { ...current, ...input };
    await this.executor.run(
      `UPDATE dictionary_items
       SET item_value = ${this.p(1)}, label_i18n_key = ${this.p(2)}, sort_order = ${this.p(3)}, status = ${this.p(4)}
       WHERE id = ${this.p(5)}`,
      [next.itemValue, next.labelI18nKey, next.sortOrder, next.status, id],
    );
    return this.getDictionaryItem(id);
  }

  async listI18nMessages(): Promise<I18nMessageRecord[]> {
    const rows = await this.executor.all(
      `SELECT id, tenant_id, message_key, language, message_value, module, updated_at
       FROM i18n_messages ORDER BY module, message_key, language LIMIT 500`,
    );
    return rows.map(toI18nMessage);
  }

  async updateI18nMessage(
    id: string,
    input: UpdateI18nMessageRequest,
  ): Promise<I18nMessageRecord | null> {
    await this.executor.run(
      `UPDATE i18n_messages SET message_value = ${this.p(1)}, updated_at = ${this.p(2)}
       WHERE id = ${this.p(3)}`,
      [input.messageValue, nowIso(), id],
    );
    return (await this.listI18nMessages()).find((record) => record.id === id) ?? null;
  }

  private async getDictionaryItem(id: string): Promise<DictionaryItemRecord | null> {
    const rows = await this.executor.all(
      `SELECT id, tenant_id, type_id, item_value, label_i18n_key, sort_order, status
       FROM dictionary_items WHERE id = ${this.p(1)} LIMIT 1`,
      [id],
    );
    return rows[0] ? toDictionaryItem(rows[0]) : null;
  }

  private p(index: number): string {
    return this.executor.dialect === "postgresql" ? `$${index}` : "?";
  }
}

function toSystemConfig(row: DatabaseRow): SystemConfigRecord {
  return {
    id: String(row.id),
    tenantId: nullableId(row.tenant_id),
    configKey: String(row.config_key),
    configValue: readJson(row.config_value) as ConfigValue,
    valueType: String(row.value_type) as SystemConfigRecord["valueType"],
    groupKey: String(row.group_key),
    description: nullableString(row.description),
    editable: Boolean(row.editable),
    status: String(row.status) as SystemConfigRecord["status"],
    updatedAt: iso(row.updated_at),
  };
}

function toDictionaryType(row: DatabaseRow): DictionaryTypeRecord {
  return {
    id: String(row.id),
    tenantId: nullableId(row.tenant_id),
    code: String(row.code),
    name: String(row.name),
    description: nullableString(row.description),
    status: String(row.status) as DictionaryTypeRecord["status"],
  };
}

function toDictionaryItem(row: DatabaseRow): DictionaryItemRecord {
  return {
    id: String(row.id),
    tenantId: nullableId(row.tenant_id),
    typeId: String(row.type_id),
    itemValue: String(row.item_value),
    labelI18nKey: String(row.label_i18n_key),
    sortOrder: Number(row.sort_order),
    status: String(row.status) as DictionaryItemRecord["status"],
  };
}

function toI18nMessage(row: DatabaseRow): I18nMessageRecord {
  return {
    id: String(row.id),
    tenantId: nullableId(row.tenant_id),
    messageKey: String(row.message_key),
    language: String(row.language),
    messageValue: String(row.message_value),
    module: String(row.module),
    updatedAt: iso(row.updated_at),
  };
}

function inferValueType(value: ConfigValue): SystemConfigRecord["valueType"] {
  if (typeof value === "string") return "string";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  return "json";
}

function iso(value: unknown): string {
  return new Date(String(value)).toISOString();
}

function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function nullableId(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}
