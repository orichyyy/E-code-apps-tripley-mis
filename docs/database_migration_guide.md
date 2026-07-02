# Database Migration Guide

## Current State

`packages/db` contains Drizzle schemas, hand-written migration files, and executable migration runners for SQLite and PostgreSQL.

```text
packages/db/src/schema/sqlite.ts
packages/db/src/schema/postgresql.ts
packages/db/src/migrations/sqlite/0001_backend_core_foundation.sql
packages/db/src/migrations/postgresql/0001_backend_core_foundation.sql
```

No SQL Server v1 schema or migration code is present.

## Commands

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:migrate:sqlite
pnpm db:migrate:postgresql
```

SQLite local/demo migrations use `better-sqlite3`.

`pnpm db:migrate` runs SQLite migrations by default and runs PostgreSQL migrations only when `TEST_DATABASE_URL` or `DATABASE_URL` is present. `pnpm db:migrate:postgresql` is explicit and requires one of those PostgreSQL URLs.

PostgreSQL integration tests follow the same `TEST_DATABASE_URL` contract. When the variable is absent, PostgreSQL-only migration smoke tests are skipped instead of silently using SQLite.
