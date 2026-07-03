# Known Gaps

This file records incomplete requirements that must not be claimed complete.

## Database and Persistence Work

- SQLite local/demo migration execution uses the confirmed `better-sqlite3` driver.
- PostgreSQL migration execution and PostgreSQL smoke tests use an externally provided `TEST_DATABASE_URL` or `DATABASE_URL`.
- PostgreSQL tests are skipped when `TEST_DATABASE_URL` is absent in the local environment.
- DB-backed backend-core persistence now exists behind `BACKEND_CORE_STORE=database` for initialization, auth sessions, refresh tokens, users, organizations, roles, role permissions, permissions, menus, menu/API bindings, route metadata, API permission metadata, and user-organization-role bindings.
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
- Announcements and webhook subscriptions now have database schema, backend APIs, OpenAPI coverage, PostgreSQL tests, and frontend API integration for announcements where a route exists.
- Announcement organization scoping currently stores the confirmed `scope_type` only. A concrete organization target/reference field is not implemented because it has not been confirmed in the base contract.
- External webhook delivery, retry workers, SMTP delivery, and S3-compatible storage are not complete concrete drivers yet.
- Worker execution now has queue/scheduler registration boundaries plus durable `runOnce`/polling hooks over database queue and scheduler adapters. Full production task catalogs, cron expression evaluation, timeout enforcement, and dead-letter workflows remain reserved or incomplete.
- Redis, RabbitMQ, S3-compatible storage, and SMTP remain optional placeholders only; no mandatory dependencies have been added.
- Frontend pages use real API fetches for implemented infrastructure modules where backend APIs exist. Pages whose backend APIs are still incomplete continue to use typed placeholder data.
- Frontend system configuration and dictionary pages now use real API fetches when an access token is available. i18n message management has backend APIs but does not yet have a dedicated frontend management page beyond the existing English/Chinese UI message bundle.
- No webhook subscription frontend route/page exists yet, so the management UI is not implemented.

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
