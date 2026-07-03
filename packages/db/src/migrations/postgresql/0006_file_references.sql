CREATE TABLE IF NOT EXISTS file_references (
  id SERIAL PRIMARY KEY,
  file_object_id INTEGER NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  reference_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL,
  created_by INTEGER,
  CHECK (status IN ('active', 'invalid'))
);
CREATE INDEX IF NOT EXISTS file_references_file_idx ON file_references (file_object_id, status);
CREATE INDEX IF NOT EXISTS file_references_resource_idx ON file_references (resource_type, resource_id);
