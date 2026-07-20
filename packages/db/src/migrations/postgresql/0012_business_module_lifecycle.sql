ALTER TABLE menus ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE menus ADD COLUMN owner_module TEXT;

ALTER TABLE route_metadata ADD COLUMN source TEXT NOT NULL DEFAULT 'base_manifest';
ALTER TABLE route_metadata ADD COLUMN owner_module TEXT;

ALTER TABLE api_permissions ADD COLUMN source TEXT NOT NULL DEFAULT 'base_manifest';
ALTER TABLE api_permissions ADD COLUMN manifest_hash TEXT;

ALTER TABLE i18n_messages ADD COLUMN default_message TEXT NOT NULL DEFAULT '';
ALTER TABLE i18n_messages ADD COLUMN override_value TEXT;
ALTER TABLE i18n_messages ADD COLUMN status TEXT NOT NULL DEFAULT 'enabled'
  CHECK (status IN ('enabled', 'disabled'));
ALTER TABLE i18n_messages ADD COLUMN manifest_hash TEXT;

CREATE TABLE business_module_registry_state (
  id SERIAL PRIMARY KEY,
  singleton_key TEXT NOT NULL DEFAULT 'current',
  registry_hash TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL,
  accepted_by INTEGER,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX business_module_registry_state_singleton_unique
  ON business_module_registry_state (singleton_key);

CREATE TABLE business_module_registry_entries (
  id SERIAL PRIMARY KEY,
  module_code TEXT NOT NULL,
  definition_json JSONB NOT NULL,
  definition_hash TEXT NOT NULL,
  activation_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  accepted_at TIMESTAMPTZ NOT NULL,
  accepted_by INTEGER,
  disabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CHECK (status IN ('active', 'disabled'))
);
CREATE UNIQUE INDEX business_module_registry_entries_code_unique
  ON business_module_registry_entries (module_code);
