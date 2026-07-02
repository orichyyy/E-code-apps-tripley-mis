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

9. **Default initialization records for system configuration, dictionaries, and i18n**

   The PRD and design spec require initialization to create default system configuration, default dictionaries, and default i18n messages, but they do not define the canonical keys, dictionary types/items, languages/messages, editable flags, or default values. Please confirm the exact default record set before adding seed data or database migrations for these modules.

## Backend Infrastructure Modules Blockers

10. **Executable database-backed infrastructure depends on PostgreSQL test provisioning and migration execution**

    The infrastructure goal requires PostgreSQL-only tests, database-backed cache/queue/event-bus/rate-limit/token-store/job/log/file/notification/import-export persistence, and the `pnpm db:migrate` validation command. Existing question 2 still blocks how PostgreSQL integration tests and migrations should connect to a database. Please confirm the PostgreSQL test database source/provisioning approach before adding executable DB-backed infrastructure tests and migration behavior.

11. **SQLite driver selection still blocks local/demo database-backed infrastructure**

    The infrastructure goal requires SQLite to remain usable for local development, testing, and demo usage, while existing questions 1 and 3 confirm the SQLite driver and int64 mapping are still unresolved. Please confirm whether database-backed infrastructure adapters should wait for the SQLite driver decision, or whether they should be implemented only behind Drizzle interfaces until the concrete SQLite runtime is selected.

12. **Database LockAdapter concrete algorithm**

    The design spec explicitly states that the database lock internal algorithm is intentionally not fixed and that PostgreSQL advisory locks, SQLite table-lock behavior, or a specific lease-table algorithm must not be hard-coded unless separately approved. Please confirm the v1 database lock semantics, including lease storage, owner/fencing token behavior, timeout/heartbeat behavior, and dialect-specific constraints, before implementing a concrete database `LockAdapter` driver.

13. **RabbitMQ driver package and delivery semantics**

    The spec requires RabbitMQ queue and RabbitMQ-compatible event bus drivers, but does not define the Node package, connection configuration, exchange/queue topology, acknowledgement and nack behavior, persistence/durability settings, requeue behavior, ordering expectations, or idempotency contract. Please confirm these details before adding concrete RabbitMQ drivers and dependencies.

14. **Optional Redis dependency strategy**

    Redis drivers are listed for cache, rate limit, and token store, while the infrastructure goal says Redis must not be a mandatory dependency. Please confirm whether Redis drivers should be implemented through optional peer dependencies and dynamic imports, interface-only placeholders, or postponed until a concrete optional dependency strategy is approved.

15. **S3-compatible storage client and configuration contract**

    The spec requires S3-compatible storage and private download through backend authentication, but does not define the client package or configuration keys such as endpoint, region, bucket, credentials source, path-style addressing, server-side encryption, object key layout, or presigned URL policy. Please confirm the v1 S3-compatible storage contract before adding a concrete driver.

16. **SMTP and webhook delivery semantics**

    The spec requires SMTP email and webhook notification channels, but does not define the SMTP client package, TLS/auth settings, sender configuration, webhook signing format, timeout, retry behavior, delivery persistence, or failure status model. Please confirm these driver-level semantics before adding concrete SMTP and webhook sending drivers.

17. **Infrastructure table scope for adapter persistence**

    The PRD/design define logical tables for files, notifications, scheduled tasks, queue jobs, import/export tasks, and logs, but database cache, database rate limit, database lock, and database outbox persistence shapes are not fully specified. Please confirm whether v1 should introduce concrete tables for these adapter internals, and if so the canonical table names, fields, indexes, and retention rules.

18. **Import/export resource scope in the infrastructure goal**

    The design says the import/export framework is reusable for base modules and future business modules, and no example business module may be implemented. Please confirm whether this goal should implement only the generic CSV framework/tasks/utilities, or also concrete import/export handlers for existing base resources such as users and logs.

19. **Scheduled task retry behavior versus reserved queue retry/dead-letter behavior**

    The PRD requires scheduled jobs to support retry configuration, while the design says detailed dead-letter queue behavior is reserved and queue retry/dead-letter behavior is not required beyond the simple status model. Please confirm the exact v1 retry behavior expected for scheduled tasks and queue jobs so the implementation does not overbuild reserved dead-letter semantics.

20. **Notification template seed records**

    The spec requires multilingual templates for in-app, email, and reserved SMS templates, but does not define canonical template codes, default languages, subjects, bodies, variables, or seed records. Please confirm whether v1 should add schemas only, or seed a specific default template set.
