# Known Gaps

This file records incomplete requirements that must not be claimed complete.

## Database and Persistence Work

- SQLite local/demo migration execution uses the confirmed `better-sqlite3` driver.
- PostgreSQL migration execution and PostgreSQL smoke tests use an externally provided `TEST_DATABASE_URL` or `DATABASE_URL`.
- PostgreSQL tests are skipped when `TEST_DATABASE_URL` is absent in the local environment.
- Durable DB-backed repositories for auth, sessions, users, organizations, roles, permissions, menus, route metadata, API permission metadata, and initialization are not implemented.
- CLI seed and first-start initialization currently use the in-memory service boundary, not durable DB-backed persistence.

## Auth and Permission Gaps

- Cookie refresh/logout CSRF protection is not finalized because the CSRF token/header/cookie strategy is unconfirmed.
- Role data-permission persistence is not implemented because the role binding model is unconfirmed.
- Role field-permission persistence is not implemented because the target/binding model is unconfirmed.
- User permission overrides are not implemented because v1 scope, conflict behavior, and FK shape are unconfirmed.
- `GET /api/permissions/tree` is not implemented because the permission hierarchy model conflicts between PRD and design spec.

## Base Module Gaps

- System configuration, dictionary management, file management, notifications, logs, scheduled tasks, import/export, and i18n management are not durable backend modules yet.
- Worker execution is still a skeleton and does not process durable queue jobs.
- Infrastructure drivers requiring Redis, RabbitMQ, S3-compatible storage, SMTP, and concrete database adapter tables remain incomplete unless explicitly implemented in the adapter package.

## Validation Gaps

- `pnpm db:migrate:postgresql` cannot run without `TEST_DATABASE_URL` or `DATABASE_URL`.
- PostgreSQL database tests are smoke-level only until DB-backed repositories are implemented.
- SQLite is executable locally through `better-sqlite3`, including bigint-safe organization path reads at the driver boundary.
