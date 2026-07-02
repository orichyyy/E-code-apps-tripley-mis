# Implementation Questions

## Backend Core Foundation Blockers

1. **Concrete SQLite driver for local/demo migrations**

   The new goal requires SQLite to remain usable for local development, testing, and demo usage, and requires a `pnpm db:migrate` validation command. The design spec still says the concrete SQLite driver package is intentionally unspecified and must not be chosen silently. Please confirm the SQLite driver package for v1, for example `better-sqlite3`, Node's built-in `node:sqlite`, or another Drizzle-supported SQLite driver.

2. **PostgreSQL integration test database source**

   The new goal requires tests for PostgreSQL only. Please confirm whether integration tests should require an externally provided PostgreSQL URL, such as `TEST_DATABASE_URL`, or whether the repository should introduce a test database provisioning approach. This should be confirmed before adding test infrastructure.

3. **SQLite int64 materialized-path JavaScript mapping**

   The SQLite SQL migration stores organization `path` as `INTEGER`, which is SQLite's signed 64-bit integer storage class. The current Drizzle SQLite TypeScript schema maps it as an integer column without choosing a runtime driver-specific bigint mode. Please confirm whether the selected SQLite driver must preserve this value as `bigint`, or whether repositories should serialize/deserialize the organization path through a driver-specific conversion boundary.

4. **CSRF strategy for refresh/logout cookie endpoints**

   The design spec requires CSRF protection for refresh/logout cookie auth endpoints, but does not confirm the concrete CSRF token strategy, header name, cookie pairing, or same-origin policy. Please confirm the intended CSRF mechanism before the cookie-backed refresh/logout endpoints are considered complete.

5. **Role data/field permission persistence model**

   The design spec defines role-scoped endpoints `PUT /api/roles/:id/data-permissions` and `PUT /api/roles/:id/field-permissions`, but the logical data model lists `data_permission_rules` without an explicit role, target, or binding table. `field_permission_rules` has `target_type` and `target_id`, but the role endpoint contract still needs confirmation on whether role-specific field rules should be stored through those fields, through a separate role binding table, or through another confirmed model. Please confirm the persistence model before implementing these endpoints and migrations.

6. **Canonical login session table shape**

   The PRD entity list names `auth_sessions` with `id`, `current_organization_id`, `created_at`, and `last_seen_at`. The design spec table summary names `login_sessions` with `session_id`, `organization_id`, `login_at`, `last_activity_at`, `created_at`, and `updated_at`. The current foundation follows the PRD `auth_sessions` naming and fields, plus confirmed token-version/status fields. Please confirm whether v1 should keep the PRD table shape, rename to `login_sessions`, add alias fields, or add `updated_at`/`login_at`/`last_activity_at` columns before further DB-backed session work.

7. **Permission tree hierarchy model**

   The PRD requires `GET /api/permissions/tree` and describes `permission_resources.parent_id` for hierarchical permission resources. The v2 design spec replaces that with a flat `permissions` table containing `id`, `code`, `name`, `type`, `resource`, `action`, `description`, `source`, `status`, `manifest_hash`, `created_at`, and `updated_at`, with no `parent_id` or hierarchy fields. Please confirm whether v1 should add hierarchy fields, derive a virtual tree from permission `resource`/`action`/manifest metadata, or expose a flat permission list through this endpoint.

8. **User permission override persistence and endpoint contract**

   The PRD requires `PUT /api/permissions/user-overrides/{userId}` and lists `user_permission_overrides.permission_resource_id`. The v2 design spec lists `user_permission_overrides.permission_id`, matching the v2 flat `permissions` table. The backend core deliverables explicitly call out RBAC through user-organization-role bindings but do not otherwise define override behavior, conflict resolution, or cache invalidation rules. Please confirm whether user-level overrides are in v1 scope, which foreign key shape to use, and how overrides should combine with role permissions.
