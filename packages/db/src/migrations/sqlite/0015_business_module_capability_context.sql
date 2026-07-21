ALTER TABLE event_outbox ADD COLUMN event_key TEXT;
CREATE UNIQUE INDEX event_outbox_event_key_unique ON event_outbox (event_key);

ALTER TABLE import_export_tasks ADD COLUMN idempotency_key TEXT;
ALTER TABLE import_export_tasks ADD COLUMN request_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE import_export_tasks ADD COLUMN execution_context_json TEXT;
CREATE UNIQUE INDEX import_export_tasks_idempotency_unique
  ON import_export_tasks (task_type, resource_type, idempotency_key);
