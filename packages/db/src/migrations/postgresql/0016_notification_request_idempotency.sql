ALTER TABLE notifications ADD COLUMN request_key TEXT;
CREATE UNIQUE INDEX notifications_user_request_key_unique
  ON notifications (user_id, request_key);
