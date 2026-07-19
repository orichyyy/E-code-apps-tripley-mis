ALTER TABLE announcements ADD COLUMN expire_at TEXT;

CREATE TABLE announcement_targets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  announcement_id INTEGER NOT NULL,
  target_type TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  CHECK (target_type = 'organization'),
  UNIQUE (announcement_id, target_type, target_id)
);

CREATE INDEX announcement_targets_announcement_idx
  ON announcement_targets (announcement_id);
CREATE INDEX announcement_targets_target_idx
  ON announcement_targets (target_type, target_id);
