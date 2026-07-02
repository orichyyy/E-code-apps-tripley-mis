CREATE TABLE IF NOT EXISTS schema_metadata (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS organizations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER,
  path INTEGER NOT NULL,
  level INTEGER NOT NULL,
  segment INTEGER NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  manager_user_id INTEGER,
  phone TEXT,
  email TEXT,
  address TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'enabled',
  remark TEXT,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  deleted_by INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by INTEGER,
  updated_by INTEGER,
  CHECK (level BETWEEN 1 AND 8),
  CHECK (segment BETWEEN 1 AND 255),
  CHECK (status IN ('enabled', 'disabled'))
);

CREATE UNIQUE INDEX IF NOT EXISTS organizations_code_unique ON organizations (code);
CREATE UNIQUE INDEX IF NOT EXISTS organizations_path_unique ON organizations (path);
CREATE INDEX IF NOT EXISTS organizations_path_level_idx ON organizations (path, level);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER,
  username TEXT NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  avatar_file_id INTEGER,
  gender TEXT,
  employee_number TEXT,
  password_hash TEXT NOT NULL,
  primary_organization_id INTEGER,
  status TEXT NOT NULL DEFAULT 'enabled',
  first_login_password_change_required INTEGER NOT NULL DEFAULT 1,
  password_changed_at TEXT,
  password_expires_at TEXT,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  token_version INTEGER NOT NULL DEFAULT 0,
  last_login_at TEXT,
  remark TEXT,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  deleted_by INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by INTEGER,
  updated_by INTEGER,
  CHECK (status IN ('enabled', 'disabled', 'locked'))
);

CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users (username);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email);
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique ON users (phone);

CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'enabled',
  remark TEXT,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  deleted_by INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (status IN ('enabled', 'disabled'))
);

CREATE UNIQUE INDEX IF NOT EXISTS roles_code_unique ON roles (code);

CREATE TABLE IF NOT EXISTS user_organization_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER,
  user_id INTEGER NOT NULL,
  organization_id INTEGER NOT NULL,
  role_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS user_organization_roles_user_org_unique
  ON user_organization_roles (user_id, organization_id);

CREATE TABLE IF NOT EXISTS permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  permission_type TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'enabled',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (permission_type IN ('menu', 'page', 'action', 'api', 'data', 'field')),
  CHECK (status IN ('enabled', 'disabled'))
);

CREATE UNIQUE INDEX IF NOT EXISTS permissions_code_unique ON permissions (code);

CREATE TABLE IF NOT EXISTS role_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER,
  role_id INTEGER NOT NULL,
  permission_id INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS role_permissions_role_permission_unique
  ON role_permissions (role_id, permission_id);

CREATE TABLE IF NOT EXISTS menus (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER,
  parent_menu_id INTEGER,
  permission_id INTEGER,
  code TEXT NOT NULL,
  route_code TEXT,
  title_i18n_key TEXT NOT NULL,
  path TEXT NOT NULL,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'enabled',
  is_deleted INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  deleted_by INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (status IN ('enabled', 'disabled'))
);

CREATE UNIQUE INDEX IF NOT EXISTS menus_code_unique ON menus (code);
CREATE UNIQUE INDEX IF NOT EXISTS menus_path_unique ON menus (path);

CREATE TABLE IF NOT EXISTS route_metadata (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER,
  route_code TEXT NOT NULL,
  path TEXT NOT NULL,
  title_i18n_key TEXT NOT NULL,
  required_permission TEXT,
  menu_visible INTEGER NOT NULL DEFAULT 1,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'enabled',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (status IN ('enabled', 'disabled'))
);

CREATE UNIQUE INDEX IF NOT EXISTS route_metadata_route_code_unique ON route_metadata (route_code);

CREATE TABLE IF NOT EXISTS api_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  log_level TEXT NOT NULL DEFAULT 'basic',
  status TEXT NOT NULL DEFAULT 'enabled',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (log_level IN ('none', 'basic', 'request', 'request_response')),
  CHECK (status IN ('enabled', 'disabled'))
);

CREATE UNIQUE INDEX IF NOT EXISTS api_permissions_code_unique ON api_permissions (code);
CREATE UNIQUE INDEX IF NOT EXISTS api_permissions_method_path_unique ON api_permissions (method, path);

CREATE TABLE IF NOT EXISTS menu_api_bindings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER,
  menu_id INTEGER NOT NULL,
  api_permission_id INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS menu_api_bindings_unique
  ON menu_api_bindings (menu_id, api_permission_id);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER,
  user_id INTEGER NOT NULL,
  refresh_token_hash TEXT NOT NULL,
  current_organization_id INTEGER NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS auth_sessions_user_active_idx ON auth_sessions (user_id, revoked_at, expires_at);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER,
  session_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL,
  token_version INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS refresh_tokens_hash_unique ON refresh_tokens (token_hash);

CREATE TABLE IF NOT EXISTS system_initialization_state (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER,
  status TEXT NOT NULL,
  initialized_at TEXT,
  initialized_by INTEGER,
  version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (status IN ('uninitialized', 'initialized'))
);
