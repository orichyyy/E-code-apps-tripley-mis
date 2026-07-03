CREATE TABLE IF NOT EXISTS role_data_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER,
  role_id INTEGER NOT NULL,
  permission_id INTEGER NOT NULL,
  effect TEXT NOT NULL DEFAULT 'allow',
  rule_json TEXT NOT NULL,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  deleted_by INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by INTEGER,
  updated_by INTEGER,
  CHECK (effect IN ('allow', 'deny'))
);

CREATE UNIQUE INDEX IF NOT EXISTS role_data_permissions_role_permission_unique
  ON role_data_permissions (role_id, permission_id);

CREATE TABLE IF NOT EXISTS field_permission_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER,
  target_type TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  resource TEXT NOT NULL,
  field TEXT NOT NULL,
  effect TEXT NOT NULL,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  deleted_by INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by INTEGER,
  updated_by INTEGER,
  CHECK (target_type IN ('role')),
  CHECK (effect IN ('visible', 'hidden', 'readonly'))
);

CREATE UNIQUE INDEX IF NOT EXISTS field_permission_rules_target_field_unique
  ON field_permission_rules (target_type, target_id, resource, field);

CREATE TABLE IF NOT EXISTS user_permission_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER,
  user_id INTEGER NOT NULL,
  permission_id INTEGER NOT NULL,
  effect TEXT NOT NULL,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  deleted_by INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by INTEGER,
  updated_by INTEGER,
  CHECK (effect IN ('allow', 'deny'))
);

CREATE UNIQUE INDEX IF NOT EXISTS user_permission_overrides_user_permission_unique
  ON user_permission_overrides (user_id, permission_id);
