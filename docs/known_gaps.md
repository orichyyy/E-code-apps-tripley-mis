# Known Gaps

This file records incomplete requirements that must not be claimed complete.

## Database and Persistence Work

- SQLite local/demo migration execution uses the confirmed `better-sqlite3` driver.
- PostgreSQL migration execution and PostgreSQL smoke tests use an externally provided `TEST_DATABASE_URL` or `DATABASE_URL`.
- PostgreSQL tests are skipped when `TEST_DATABASE_URL` is absent in the local environment.
- DB-backed backend-core persistence now exists behind `BACKEND_CORE_STORE=database` for initialization, auth sessions, refresh tokens, users, organizations, roles, role permissions, permissions, menus, menu/API bindings, route metadata, API permission metadata, and user-organization-role bindings.
- `user_preferences` now exists in SQLite/PostgreSQL schema and DB-backed backend-core persistence for personal language, theme, theme color, and page-tab preferences.
- Normal DB-backed backend-core API mutation flows now persist through narrower per-aggregate repositories. A whole-store snapshot save helper remains for test reset and full-store support utilities.

## Auth and Permission Gaps

- Cookie refresh/logout CSRF protection is implemented with the confirmed double-submit `csrf_token` cookie plus `x-csrf-token` header strategy.
- Role data-permission, role field-permission, and user permission override persistence tables are implemented in SQLite/PostgreSQL migrations and Drizzle schema.
- Service-level APIs, DB-backed persistence, in-memory support, effective-permission evaluation, and permission-cache invalidation are implemented for role data permissions, role field permissions, and user permission overrides.
- `GET /api/permissions/tree` is implemented as the confirmed virtual tree derived from flat permission metadata.

## Base Module Gaps

- Durable infrastructure tables now exist for cache, rate limiting, locks, queue jobs, event outbox, scheduled jobs, files, notifications, notification templates, logs, and import/export tasks.
- Runnable default in-memory adapters now exist for lock, queue, event bus, rate limit, scheduler, and notifications. Local filesystem storage exists and writes through temp-file-then-rename.
- Database-backed runtime adapter drivers now exist for cache, rate limiting, lease-table locks, queue jobs, event outbox, and scheduled jobs.
- Backend API modules now exist for the implemented durable infrastructure tables: logs, files, in-app notifications, notification templates, scheduled tasks, and import/export task lists.
- System configuration, dictionary management, and i18n management now have database schema, backend APIs, OpenAPI coverage, PostgreSQL tests, and frontend API integration for the implemented pages.
- Announcements and webhook subscriptions now have database schema, backend APIs, OpenAPI coverage, PostgreSQL tests, and frontend API integration where routes exist.
- Announcement organization scoping currently stores the confirmed `scope_type` only. A concrete organization target/reference field is not implemented because it has not been confirmed in the base contract.
- External webhook delivery, retry workers, and S3-compatible storage are not complete concrete drivers yet. SMTP email delivery now has an optional configuration-driven driver and test-send API, but production retry workflows remain reserved.
- Worker execution now starts with database queue/scheduler adapters, default in-app notification dispatch task registration, durable `runOnce`, and optional polling through `WORKER_POLL_INTERVAL_MS`. Database queue jobs now support retry using `attempt`, `max_attempts`, and `next_run_at`, stale running job timeout recovery, and exhausted-job `dead_letter` status without a separate DLQ implementation. Scheduled jobs now compute `next_run_at` from standard five-field cron expressions, use a bounded running lease, retry failed executions within the stored attempt limit, and write scheduler execution logs. Full production task catalogs beyond currently implemented base tasks remain incomplete.
- Redis, RabbitMQ, and S3-compatible storage remain optional placeholders only; no mandatory dependencies have been added. SMTP remains optional and is disabled unless configured.
- Frontend pages use real API fetches for implemented infrastructure modules where backend APIs exist. Pages whose backend APIs are still incomplete continue to use typed placeholder data.
- Frontend system configuration and dictionary pages now use real API fetches when an access token is available.
- i18n message management now has a dedicated frontend route/page wired to the implemented backend APIs. The static English/Chinese UI message bundle remains the local frontend default.
- File management now has backend and frontend support for local-storage upload, metadata list/detail, authenticated download, image preview, reference listing, and delete-invalidate behavior. S3-compatible storage configuration UI and concrete S3 driver wiring remain incomplete because the package/configuration contract is still reserved.
- Announcement management now has a dedicated frontend route/page wired to the implemented backend APIs. Announcement notification delivery and organization target references remain reserved/unconfirmed.
- In-app notification management now has a dedicated frontend route/page wired to the implemented backend APIs. Internal in-app notification creation/fan-out now exists through a queue-backed dispatch service and worker task boundary; no public administrator create-notification API or frontend create flow is exposed because it is not confirmed by the base API contract.
- Webhook subscription management now has a frontend route/page wired to the implemented backend APIs. Real outbound delivery remains reserved.
- Notification template management now has a frontend route/page wired to the implemented backend APIs. SMTP template test sending is implemented through the backend API; SMS sending remains reserved.
- Personal center and personal settings now use real authenticated profile APIs for allowed self-profile fields, avatar file-id reference changes, language, theme mode, theme color, and page-tab preference persistence.

## Validation Gaps

- `pnpm db:migrate:postgresql` cannot run without `TEST_DATABASE_URL` or `DATABASE_URL`.
- PostgreSQL database tests now include backend-core DB-backed initialization, seed idempotency, session/token reload, user/organization/role/menu/route/permission mutation persistence, user-organization-role binding persistence, logout persistence, and refresh-token exchange coverage when `TEST_DATABASE_URL` is present.
- PostgreSQL database tests now include role data-permission, role field-permission, and user permission override persistence after reload, plus effective permission behavior after reload.
- SQLite is executable locally through `better-sqlite3`, including bigint-safe organization path reads at the driver boundary.
- OpenAPI request/response schemas are explicit for the permission-extension endpoints and effective permission context. Older backend-core endpoints still use the generic success envelope unless they have already been mapped.
- SQLite and PostgreSQL migrations now include the infrastructure foundation tables.
- SQLite and PostgreSQL migrations now include the system configuration, dictionary, and i18n management tables.
- SQLite and PostgreSQL migrations now include the announcements and webhook subscription tables.
- PostgreSQL integration tests now cover database-backed infrastructure adapter drivers and DB-backed infrastructure API persistence. SQLite adapter smoke coverage remains executable locally.
- PostgreSQL integration tests now cover DB-backed announcement and webhook subscription persistence.
- PostgreSQL integration tests now cover profile preference persistence after DB-backed reload.
- PostgreSQL integration tests now cover DB-backed email template lookup for the SMTP test-send API.
- PostgreSQL integration tests now cover queue-backed in-app notification dispatch into persisted notification records.
