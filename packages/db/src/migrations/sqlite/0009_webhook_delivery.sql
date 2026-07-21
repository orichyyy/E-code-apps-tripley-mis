ALTER TABLE webhook_subscriptions ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_outbox_id INTEGER NOT NULL,
  subscription_id INTEGER NOT NULL,
  subscription_revision INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  event_source TEXT NOT NULL,
  event_payload_json TEXT NOT NULL,
  target_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempt INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL,
  next_attempt_at TEXT NOT NULL,
  locked_by TEXT,
  locked_at TEXT,
  last_http_status INTEGER,
  last_error_code TEXT,
  last_error_message TEXT,
  succeeded_at TEXT,
  failed_at TEXT,
  canceled_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (event_outbox_id, subscription_id),
  CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'canceled'))
);
CREATE INDEX IF NOT EXISTS webhook_deliveries_claim_idx ON webhook_deliveries (status, next_attempt_at);
CREATE INDEX IF NOT EXISTS webhook_deliveries_subscription_idx ON webhook_deliveries (subscription_id, created_at);

CREATE TABLE IF NOT EXISTS webhook_delivery_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  delivery_id INTEGER NOT NULL,
  attempt_number INTEGER NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  http_status INTEGER,
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (delivery_id, attempt_number),
  CHECK (status IN ('succeeded', 'failed'))
);
CREATE INDEX IF NOT EXISTS webhook_delivery_attempts_delivery_idx ON webhook_delivery_attempts (delivery_id);
