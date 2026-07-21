DROP INDEX field_permission_rules_target_field_unique;

ALTER TABLE field_permission_rules
  ADD COLUMN scenario TEXT NOT NULL DEFAULT 'detail'
  CHECK (scenario IN ('list', 'detail', 'create', 'edit'));

CREATE UNIQUE INDEX field_permission_rules_target_field_unique
  ON field_permission_rules (target_type, target_id, resource, field, scenario);
