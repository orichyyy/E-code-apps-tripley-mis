ALTER TABLE file_objects ADD COLUMN storage_bucket TEXT;
ALTER TABLE file_objects ADD COLUMN content_deleted_at TEXT;
CREATE INDEX IF NOT EXISTS file_objects_content_cleanup_idx
  ON file_objects (status, is_deleted, content_deleted_at);
