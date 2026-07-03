CREATE TABLE IF NOT EXISTS announcements (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by INTEGER,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  created_by INTEGER,
  updated_by INTEGER,
  CHECK (scope_type IN ('system', 'organization')),
  CHECK (status IN ('draft', 'published', 'deleted'))
);
CREATE INDEX IF NOT EXISTS announcements_status_idx ON announcements (status, published_at);

CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  event_types JSONB NOT NULL,
  secret TEXT,
  status TEXT NOT NULL DEFAULT 'enabled',
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by INTEGER,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  created_by INTEGER,
  updated_by INTEGER,
  CHECK (status IN ('enabled', 'disabled'))
);
CREATE INDEX IF NOT EXISTS webhook_subscriptions_status_idx ON webhook_subscriptions (status);
