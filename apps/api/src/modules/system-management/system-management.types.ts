export type ConfigValue = string | number | boolean | Record<string, unknown> | unknown[];
export type EnabledStatus = "enabled" | "disabled";

export type SystemConfigRecord = {
  id: string;
  tenantId: string | null;
  configKey: string;
  configValue: ConfigValue;
  valueType: "string" | "number" | "boolean" | "json";
  groupKey: string;
  description: string | null;
  editable: boolean;
  status: EnabledStatus;
  updatedAt: string;
};

export type DictionaryTypeRecord = {
  id: string;
  tenantId: string | null;
  code: string;
  name: string;
  description: string | null;
  status: EnabledStatus;
};

export type DictionaryItemRecord = {
  id: string;
  tenantId: string | null;
  typeId: string;
  itemValue: string;
  labelI18nKey: string;
  sortOrder: number;
  status: EnabledStatus;
};

export type I18nMessageRecord = {
  id: string;
  tenantId: string | null;
  messageKey: string;
  language: string;
  messageValue: string;
  defaultMessage: string;
  overrideValue: string | null;
  module: string;
  status: EnabledStatus;
  manifestHash: string | null;
  updatedAt: string;
};
