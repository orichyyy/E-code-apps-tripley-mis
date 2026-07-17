ALTER TABLE webhook_subscriptions
  ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id SERIAL PRIMARY KEY,
  event_outbox_id INTEGER NOT NULL,
  subscription_id INTEGER NOT NULL,
  subscription_revision INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  event_source TEXT NOT NULL,
  event_payload_json JSONB NOT NULL,
  target_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempt INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL,
  next_attempt_at TIMESTAMPTZ NOT NULL,
  locked_by TEXT,
  locked_at TIMESTAMPTZ,
  last_http_status INTEGER,
  last_error_code TEXT,
  last_error_message TEXT,
  succeeded_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT webhook_deliveries_event_subscription_unique UNIQUE (event_outbox_id, subscription_id),
  CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'canceled'))
);
CREATE INDEX IF NOT EXISTS webhook_deliveries_claim_idx ON webhook_deliveries (status, next_attempt_at);
CREATE INDEX IF NOT EXISTS webhook_deliveries_subscription_idx ON webhook_deliveries (subscription_id, created_at);

CREATE TABLE IF NOT EXISTS webhook_delivery_attempts (
  id SERIAL PRIMARY KEY,
  delivery_id INTEGER NOT NULL,
  attempt_number INTEGER NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ NOT NULL,
  duration_ms INTEGER NOT NULL,
  http_status INTEGER,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT webhook_delivery_attempts_delivery_number_unique UNIQUE (delivery_id, attempt_number),
  CHECK (status IN ('succeeded', 'failed'))
);
CREATE INDEX IF NOT EXISTS webhook_delivery_attempts_delivery_idx ON webhook_delivery_attempts (delivery_id);
