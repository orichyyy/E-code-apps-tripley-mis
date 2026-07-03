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

   Implemented handling: system configuration, dictionary, and i18n schema/API support is implemented without adding unconfirmed default seed records.

## Backend Core Foundation Blockers

No unresolved backend-core blockers remain from the previously listed questions. Role data permissions, role field permissions, and user permission overrides now have service-level APIs and effective-permission behavior; remaining gaps are tracked in `docs/known_gaps.md`.

## Backend Infrastructure Modules Blockers

10. **Executable database-backed infrastructure depends on durable repository scope**

    Confirmed: implement durable PostgreSQL infrastructure repositories and tests first. SQLite must remain migration-executable and usable for local/demo compatibility, but PostgreSQL is the tested durable deployment target.

11. **SQLite local/demo database-backed infrastructure boundary**

    Confirmed: SQLite infrastructure migrations should remain executable for local/demo compatibility. Runtime durable database adapters may be implemented behind the shared database boundary, with PostgreSQL as the required integration-test target.

12. **Database LockAdapter concrete algorithm**

    Confirmed: v1 database locks use a lease table, not PostgreSQL advisory locks. The table records lock key, owner, fencing token, expiration time, and heartbeat time. Acquisition succeeds only when no unexpired lease exists or the existing lease has expired.

13. **RabbitMQ driver package and delivery semantics**

    Confirmed: v1 keeps RabbitMQ as an optional interface/driver placeholder and does not add a RabbitMQ package or mandatory dependency until package/configuration/delivery semantics are separately confirmed.

14. **Optional Redis dependency strategy**

    Confirmed: v1 keeps Redis as optional dynamic-import/interface placeholders and does not add a mandatory Redis dependency.

15. **S3-compatible storage client and configuration contract**

    Confirmed: v1 provides local filesystem storage as the runnable default and keeps S3-compatible storage behind an interface/configuration placeholder until concrete client package and configuration keys are confirmed.

16. **SMTP and webhook delivery semantics**

    Confirmed: v1 implements notification channel interfaces and durable notification records. SMTP email sending uses an optional configuration-driven driver over Node.js built-ins and remains disabled unless `SMTP_ENABLED=true` with host/from configuration. Webhook/in-memory behavior may be represented as placeholders.

    Implemented handling: webhook subscription persistence and management APIs are implemented without adding real external delivery, retry workers, or mandatory webhook sender dependencies. SMTP template test sending is implemented without adding a mandatory external package.

17. **Infrastructure table scope for adapter persistence**

    Confirmed: v1 introduces minimal durable adapter tables named `cache_entries`, `rate_limit_counters`, `locks`, `queue_jobs`, `event_outbox`, and `scheduled_jobs`, plus durable base-module tables for logs, files, notifications, and import/export tasks as needed by implemented modules.

18. **Import/export resource scope in the infrastructure goal**

    Confirmed: v1 implements the generic CSV framework/task model only. It must not implement example business modules. Existing base-system log export may use the generic CSV export path.

19. **Scheduled task retry behavior versus reserved queue retry/dead-letter behavior**

    Confirmed: v1 queue/job retry uses `attempt`, `max_attempts`, and `next_run_at`. Dead-letter behavior remains reserved and is represented only by status/fields, without a complex DLQ implementation.

20. **Notification template seed records**

    Confirmed: v1 adds schemas/APIs for multilingual notification templates but does not seed unconfirmed default template content. SMS templates remain reserved.

21. **Announcement organization scope reference**

    Confirmed implementation boundary: announcements persist the confirmed `scope_type` values `system` and `organization`. A concrete organization target/reference field is not added in v1 until the API contract and multi-organization audience semantics are explicitly confirmed.
