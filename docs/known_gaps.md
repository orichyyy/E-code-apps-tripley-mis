# Known Gaps

This file records incomplete requirements that must not be claimed complete.

## Database and Persistence Work

- SQLite local/demo migration execution uses the confirmed `better-sqlite3` driver.
- PostgreSQL migration execution and PostgreSQL smoke tests use an externally provided `TEST_DATABASE_URL` or `DATABASE_URL`.
- PostgreSQL tests are skipped when `TEST_DATABASE_URL` is absent in the local environment.
- DB-backed backend-core persistence now exists behind `BACKEND_CORE_STORE=database` for initialization, auth sessions, refresh tokens, users, organizations, roles, role permissions, permissions, menus, menu/API bindings, route metadata, API permission metadata, and user-organization-role bindings.
- The DB-backed repository currently snapshots the existing backend-core store into relational tables. Future work should replace this with narrower per-aggregate repositories before high-concurrency production use.

## Auth and Permission Gaps

- Cookie refresh/logout CSRF protection is implemented with the confirmed double-submit `csrf_token` cookie plus `x-csrf-token` header strategy.
- Role data-permission, role field-permission, and user permission override persistence tables are implemented in SQLite/PostgreSQL migrations and Drizzle schema. Service-level APIs and effective-permission evaluation for these extension records are still not implemented.
- `GET /api/permissions/tree` is implemented as the confirmed virtual tree derived from flat permission metadata.

## Base Module Gaps

- System configuration, dictionary management, file management, notifications, logs, scheduled tasks, import/export, and i18n management are not durable backend modules yet.
- Worker execution is still a skeleton and does not process durable queue jobs.
- Infrastructure drivers requiring Redis, RabbitMQ, S3-compatible storage, SMTP, and concrete database adapter tables remain incomplete unless explicitly implemented in the adapter package.

## Validation Gaps

- `pnpm db:migrate:postgresql` cannot run without `TEST_DATABASE_URL` or `DATABASE_URL`.
- PostgreSQL database tests now include backend-core DB-backed initialization, session/token reload, user/menu/route/permission persistence, and refresh-token exchange coverage when `TEST_DATABASE_URL` is present.
- SQLite is executable locally through `better-sqlite3`, including bigint-safe organization path reads at the driver boundary.
