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
- Database-backed runtime adapter drivers over the new durable infrastructure tables are not complete yet.
- System configuration, dictionary management, file management, notifications, logs, scheduled tasks, import/export, and i18n management are not complete backend API modules yet.
- Worker execution now has queue/scheduler registration boundaries, but durable task polling/execution over `queue_jobs` and `scheduled_jobs` is not complete yet.
- Redis, RabbitMQ, S3-compatible storage, and SMTP remain optional placeholders only; no mandatory dependencies have been added.
- Frontend pages still use typed placeholder data for modules whose backend APIs are not complete. Real API integration is complete only for backend-core APIs already implemented in prior goals.

## Validation Gaps

- `pnpm db:migrate:postgresql` cannot run without `TEST_DATABASE_URL` or `DATABASE_URL`.
- PostgreSQL database tests now include backend-core DB-backed initialization, seed idempotency, session/token reload, user/organization/role/menu/route/permission mutation persistence, user-organization-role binding persistence, logout persistence, and refresh-token exchange coverage when `TEST_DATABASE_URL` is present.
- PostgreSQL database tests now include role data-permission, role field-permission, and user permission override persistence after reload, plus effective permission behavior after reload.
- SQLite is executable locally through `better-sqlite3`, including bigint-safe organization path reads at the driver boundary.
- OpenAPI request/response schemas are explicit for the permission-extension endpoints and effective permission context. Older backend-core endpoints still use the generic success envelope unless they have already been mapped.
- SQLite and PostgreSQL migrations now include the infrastructure foundation tables. PostgreSQL integration tests for database-backed infrastructure runtime drivers remain pending until those drivers are implemented.
