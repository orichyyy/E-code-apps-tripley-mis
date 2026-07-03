CREATE TABLE IF NOT EXISTS system_configs (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER,
  config_key TEXT NOT NULL UNIQUE,
  config_value JSONB NOT NULL,
  value_type TEXT NOT NULL,
  group_key TEXT NOT NULL,
  description TEXT,
  editable BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'enabled',
  updated_at TIMESTAMPTZ NOT NULL,
  CHECK (value_type IN ('string', 'number', 'boolean', 'json')),
  CHECK (status IN ('enabled', 'disabled'))
);
CREATE INDEX IF NOT EXISTS system_configs_group_idx ON system_configs (group_key);

CREATE TABLE IF NOT EXISTS dictionary_types (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'enabled',
  CHECK (status IN ('enabled', 'disabled'))
);

CREATE TABLE IF NOT EXISTS dictionary_items (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER,
  type_id INTEGER NOT NULL,
  item_value TEXT NOT NULL,
  label_i18n_key TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'enabled',
  CHECK (status IN ('enabled', 'disabled'))
);
CREATE UNIQUE INDEX IF NOT EXISTS dictionary_items_type_value_unique
  ON dictionary_items (type_id, item_value);
CREATE INDEX IF NOT EXISTS dictionary_items_type_idx ON dictionary_items (type_id);

CREATE TABLE IF NOT EXISTS i18n_messages (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER,
  message_key TEXT NOT NULL,
  language TEXT NOT NULL,
  message_value TEXT NOT NULL,
  module TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS i18n_messages_key_language_unique
  ON i18n_messages (message_key, language);
CREATE INDEX IF NOT EXISTS i18n_messages_module_idx ON i18n_messages (module);
