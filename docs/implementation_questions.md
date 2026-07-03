# Implementation Questions

## Confirmed Backend Core Decisions

1. **Concrete SQLite driver for local/demo migrations**

   Confirmed: v1 local development, testing, and demo migrations use `better-sqlite3` behind the database package connection boundary.

2. **PostgreSQL integration test database source**

   Confirmed: PostgreSQL integration tests use an externally provided `TEST_DATABASE_URL`. Explicit PostgreSQL migration execution may also use `DATABASE_URL`.

3. **SQLite int64 materialized-path JavaScript mapping**

   Confirmed: the `better-sqlite3` driver boundary enables safe integer reads so organization `path` values round-trip as `bigint` when raw driver access is used. DB-backed repositories must preserve this boundary when they are introduced.

4. **CSRF strategy for refresh/logout cookie endpoints**

   Confirmed: v1 uses a double-submit cookie strategy. Login issues a non-HttpOnly `csrf_token` cookie alongside the HttpOnly `refresh_token`; refresh and logout require the same token in the `x-csrf-token` header. The cookie uses SameSite Strict by default and follows the configured refresh-cookie path/secure/domain settings.

5. **Canonical login session table shape**

   Confirmed: v1 keeps the PRD `auth_sessions` table name and existing fields, plus the already implemented token-version and status fields.

6. **Permission tree hierarchy model**

   Confirmed: v1 derives a virtual permission tree from flat permission metadata (`module`, `resource`, `action`, `permission_type`). No `parent_id` is added to the permissions table.

7. **Role data/field permission persistence model**

   Confirmed: role data permissions use a `role_data_permissions` binding table. Role field permissions use `field_permission_rules` with `target_type = 'role'` and `target_id = role_id`.

8. **User permission override persistence and precedence**

   Confirmed: v1 user overrides use `permission_id` with `allow`/`deny` effects. User overrides have higher priority than role grants.

9. **Default initialization records for system configuration, dictionaries, and i18n**

   Confirmed: seed only confirmed base system configuration, dictionary, and i18n data. Do not invent default records whose canonical keys and values are not specified.

## Backend Core Foundation Blockers

No unresolved backend-core blockers remain from the previously listed questions. Role data permissions, role field permissions, and user permission overrides now have service-level APIs and effective-permission behavior; remaining gaps are tracked in `docs/known_gaps.md`.

## Backend Infrastructure Modules Blockers

10. **Executable database-backed infrastructure depends on durable repository scope**

    The infrastructure goal requires PostgreSQL-only tests and database-backed cache/queue/event-bus/rate-limit/token-store/job/log/file/notification/import-export persistence. PostgreSQL test connectivity is now confirmed through `TEST_DATABASE_URL`, but durable adapter table shape and repository scope remain unconfirmed.

11. **SQLite local/demo database-backed infrastructure boundary**

    SQLite driver selection is now confirmed as `better-sqlite3`. Please confirm whether database-backed infrastructure adapters should be implemented for SQLite immediately, or whether they should be implemented only behind Drizzle interfaces until durable PostgreSQL repositories are completed.

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
