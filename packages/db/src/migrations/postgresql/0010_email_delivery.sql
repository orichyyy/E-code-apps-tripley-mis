DROP INDEX IF EXISTS notification_templates_code_locale_unique;
CREATE UNIQUE INDEX IF NOT EXISTS notification_templates_channel_code_locale_unique
  ON notification_templates (channel, code, locale);

CREATE TABLE IF NOT EXISTS email_deliveries (
  id SERIAL PRIMARY KEY,
  request_key TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  template_id INTEGER NOT NULL,
  template_code TEXT NOT NULL,
  locale TEXT NOT NULL,
  template_updated_at TIMESTAMPTZ NOT NULL,
  masked_recipient TEXT NOT NULL,
  message_id TEXT NOT NULL,
  content_key_id TEXT,
  content_envelope TEXT,
  reference_type TEXT,
  reference_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  attempt INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL,
  next_attempt_at TIMESTAMPTZ NOT NULL,
  locked_by TEXT,
  locked_at TIMESTAMPTZ,
  last_smtp_code INTEGER,
  last_error_code TEXT,
  last_error_message TEXT,
  succeeded_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  content_purged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT email_deliveries_request_user_unique UNIQUE (request_key, user_id),
  CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'canceled'))
);
CREATE INDEX IF NOT EXISTS email_deliveries_claim_idx ON email_deliveries (status, next_attempt_at);
CREATE INDEX IF NOT EXISTS email_deliveries_user_idx ON email_deliveries (user_id, created_at);
CREATE INDEX IF NOT EXISTS email_deliveries_template_idx ON email_deliveries (template_code, locale, created_at);

CREATE TABLE IF NOT EXISTS email_delivery_attempts (
  id SERIAL PRIMARY KEY,
  delivery_id INTEGER NOT NULL,
  attempt_number INTEGER NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ NOT NULL,
  duration_ms INTEGER NOT NULL,
  smtp_code INTEGER,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT email_delivery_attempts_delivery_number_unique UNIQUE (delivery_id, attempt_number),
  CHECK (status IN ('succeeded', 'failed'))
);
CREATE INDEX IF NOT EXISTS email_delivery_attempts_delivery_idx ON email_delivery_attempts (delivery_id);
