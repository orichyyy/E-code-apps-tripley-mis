CREATE TABLE IF NOT EXISTS cache_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value_json TEXT NOT NULL,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS cache_entries_expires_at_idx ON cache_entries (expires_at);

CREATE TABLE IF NOT EXISTS rate_limit_counters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL,
  window_starts_at TEXT NOT NULL,
  window_seconds INTEGER NOT NULL,
  count INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS rate_limit_counters_key_window_unique
  ON rate_limit_counters (key, window_starts_at);
CREATE INDEX IF NOT EXISTS rate_limit_counters_expires_at_idx ON rate_limit_counters (expires_at);

CREATE TABLE IF NOT EXISTS locks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  owner TEXT NOT NULL,
  fencing_token INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  heartbeat_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS locks_expires_at_idx ON locks (expires_at);

CREATE TABLE IF NOT EXISTS queue_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempt INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 1,
  available_at TEXT NOT NULL,
  next_run_at TEXT,
  locked_by TEXT,
  locked_at TEXT,
  last_error TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'dead_letter'))
);
CREATE INDEX IF NOT EXISTS queue_jobs_status_available_idx ON queue_jobs (status, available_at);

CREATE TABLE IF NOT EXISTS event_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempt INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 1,
  next_run_at TEXT,
  last_error TEXT,
  occurred_at TEXT NOT NULL,
  processed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (status IN ('pending', 'published', 'failed', 'dead_letter'))
);
CREATE INDEX IF NOT EXISTS event_outbox_status_next_run_idx ON event_outbox (status, next_run_at);

CREATE TABLE IF NOT EXISTS scheduled_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  cron_expression TEXT NOT NULL,
  handler_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'enabled',
  last_run_at TEXT,
  next_run_at TEXT,
  attempt INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 1,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (status IN ('enabled', 'disabled'))
);
CREATE INDEX IF NOT EXISTS scheduled_jobs_next_run_idx ON scheduled_jobs (status, next_run_at);

CREATE TABLE IF NOT EXISTS file_objects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  object_key TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  extension TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  storage_driver TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  referenced INTEGER NOT NULL DEFAULT 0,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  deleted_by INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by INTEGER,
  updated_by INTEGER,
  CHECK (status IN ('active', 'invalid'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  channel TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unread',
  metadata_json TEXT NOT NULL,
  read_at TEXT,
  archived_at TEXT,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  deleted_by INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (channel IN ('in_app', 'email', 'webhook', 'sms')),
  CHECK (status IN ('unread', 'read', 'archived', 'deleted'))
);
CREATE INDEX IF NOT EXISTS notifications_user_status_idx ON notifications (user_id, status);

CREATE TABLE IF NOT EXISTS notification_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  channel TEXT NOT NULL,
  locale TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  variables_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'enabled',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (channel IN ('in_app', 'email', 'sms')),
  CHECK (status IN ('enabled', 'disabled'))
);
CREATE UNIQUE INDEX IF NOT EXISTS notification_templates_code_locale_unique
  ON notification_templates (code, locale);

CREATE TABLE IF NOT EXISTS log_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  log_type TEXT NOT NULL,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  trace_id TEXT,
  user_id INTEGER,
  ip_address TEXT,
  metadata_json TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (log_type IN ('login', 'operation', 'access', 'api_call', 'exception', 'security', 'scheduler', 'file_operation')),
  CHECK (level IN ('debug', 'info', 'warn', 'error'))
);
CREATE INDEX IF NOT EXISTS log_entries_type_occurred_idx ON log_entries (log_type, occurred_at);

CREATE TABLE IF NOT EXISTS import_export_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_type TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  file_object_id INTEGER,
  result_file_object_id INTEGER,
  error_file_object_id INTEGER,
  total_rows INTEGER NOT NULL DEFAULT 0,
  success_rows INTEGER NOT NULL DEFAULT 0,
  failed_rows INTEGER NOT NULL DEFAULT 0,
  error_preview_json TEXT NOT NULL,
  result_expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by INTEGER,
  CHECK (task_type IN ('import', 'export')),
  CHECK (status IN ('pending', 'running', 'succeeded', 'failed'))
);
CREATE INDEX IF NOT EXISTS import_export_tasks_status_idx ON import_export_tasks (status);
