# Database Migration Guide

## Current State

`packages/db` contains Drizzle schemas and hand-written migration files for SQLite and PostgreSQL.

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

Migration execution is intentionally blocked until the SQLite driver and PostgreSQL test/provisioning strategy are confirmed. The open questions are tracked in `docs/implementation_questions.md` and summarized in `docs/known_gaps.md`.
