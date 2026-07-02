# Known Gaps

This file records incomplete requirements that must not be claimed complete.

## Blocked Database and Persistence Work

- Executable SQLite migration support is blocked by the unconfirmed concrete SQLite driver.
- PostgreSQL migration execution and PostgreSQL database tests are blocked by the unconfirmed test/provisioning strategy.
- SQLite organization-path int64 JavaScript mapping is blocked by the unconfirmed SQLite driver behavior.
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

- `pnpm db:migrate` does not pass by design until the database provisioning questions are answered.
- PostgreSQL database tests are not implemented yet.
- SQLite remains schema/migration-file usable, but no concrete runtime driver has been selected.
