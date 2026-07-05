import type {
  CreateDictionaryItemRequest,
  CreateDictionaryTypeRequest,
  UpdateDictionaryItemRequest,
  UpdateDictionaryTypeRequest,
  UpdateI18nMessageRequest,
  UpdateSystemConfigRequest,
} from "@web-admin-base/contracts";

import { SystemManagementRepository } from "./system-management.repository";
import type {
  ConfigValue,
  DictionaryItemRecord,
  DictionaryTypeRecord,
  I18nMessageRecord,
  SystemConfigRecord,
} from "./system-management.types";

export class SystemManagementServices {
  private readonly memory = {
    systemConfigs: [] as SystemConfigRecord[],
    dictionaryTypes: [] as DictionaryTypeRecord[],
    dictionaryItems: [] as DictionaryItemRecord[],
    i18nMessages: [] as I18nMessageRecord[],
  };
  private sequence = 1;

  constructor(private readonly repository?: SystemManagementRepository) {}

  static inMemory(): SystemManagementServices {
    return new SystemManagementServices();
  }

  static database(
    repository = SystemManagementRepository.fromEnvironment(),
  ): SystemManagementServices {
    return new SystemManagementServices(repository);
  }

  close(): Promise<void> {
    return this.repository?.close() ?? Promise.resolve();
  }

  listSystemConfigs() {
    return this.repository?.listSystemConfigs() ?? Promise.resolve(this.memory.systemConfigs);
  }

  async updateSystemConfig(key: string, input: UpdateSystemConfigRequest) {
    if (this.repository) return this.repository.updateSystemConfig(key, input);
    const config = this.memory.systemConfigs.find((record) => record.configKey === key);
    if (!config || !config.editable) return config ?? null;
    Object.assign(config, {
      configValue: input.configValue,
      valueType: inferValueType(input.configValue),
      updatedAt: new Date().toISOString(),
    });
    return config;
  }

  listDictionaryTypes() {
    return this.repository?.listDictionaryTypes() ?? Promise.resolve(this.memory.dictionaryTypes);
  }

  createDictionaryType(input: CreateDictionaryTypeRequest) {
    if (this.repository) return this.repository.createDictionaryType(input);
    const record: DictionaryTypeRecord = {
      id: this.nextId(),
      tenantId: null,
      code: input.code,
      name: input.name,
      description: input.description ?? null,
      status: input.status,
    };
    this.memory.dictionaryTypes.unshift(record);
    return Promise.resolve(record);
  }

  updateDictionaryType(id: string, input: UpdateDictionaryTypeRequest) {
    if (this.repository) return this.repository.updateDictionaryType(id, input);
    const record = this.memory.dictionaryTypes.find((item) => item.id === id);
    if (!record) return Promise.resolve(null);
    Object.assign(record, input);
    return Promise.resolve(record);
  }

  listDictionaryItems(typeId: string) {
    return (
      this.repository?.listDictionaryItems(typeId) ??
      Promise.resolve(this.memory.dictionaryItems.filter((item) => item.typeId === typeId))
    );
  }

  createDictionaryItem(typeId: string, input: CreateDictionaryItemRequest) {
    if (this.repository) return this.repository.createDictionaryItem(typeId, input);
    const record: DictionaryItemRecord = {
      id: this.nextId(),
      tenantId: null,
      typeId,
      itemValue: input.itemValue,
      labelI18nKey: input.labelI18nKey,
      sortOrder: input.sortOrder,
      status: input.status,
    };
    this.memory.dictionaryItems.unshift(record);
    return Promise.resolve(record);
  }

  updateDictionaryItem(id: string, input: UpdateDictionaryItemRequest) {
    if (this.repository) return this.repository.updateDictionaryItem(id, input);
    const record = this.memory.dictionaryItems.find((item) => item.id === id);
    if (!record) return Promise.resolve(null);
    Object.assign(record, input);
    return Promise.resolve(record);
  }

  listI18nMessages() {
    return this.repository?.listI18nMessages() ?? Promise.resolve(this.memory.i18nMessages);
  }

  updateI18nMessage(id: string, input: UpdateI18nMessageRequest) {
    if (this.repository) return this.repository.updateI18nMessage(id, input);
    const record = this.memory.i18nMessages.find((item) => item.id === id);
    if (!record) return Promise.resolve(null);
    record.messageValue = input.messageValue;
    record.updatedAt = new Date().toISOString();
    return Promise.resolve(record);
  }

  private nextId(): string {
    const id = String(this.sequence);
    this.sequence += 1;
    return id;
  }
}

function inferValueType(value: ConfigValue): SystemConfigRecord["valueType"] {
  if (typeof value === "string") return "string";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  return "json";
}
