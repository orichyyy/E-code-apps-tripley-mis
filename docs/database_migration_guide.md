# Database Migration Guide

## Current State

`packages/db` contains Drizzle schemas, hand-written migration files, and executable migration runners for SQLite and PostgreSQL.

```text
packages/db/src/schema/sqlite.ts
packages/db/src/schema/postgresql.ts
packages/db/src/migrations/sqlite/
packages/db/src/migrations/postgresql/
```

Both migration directories currently contain matching ordered Base System slices from `0001_backend_core_foundation.sql` through `0011_announcement_targeting.sql`.

Business Module migration sources are registered explicitly through `packages/db/src/business-modules/registry.ts`. Base migrations always run first. Module sources then sort by permanent `moduleCode`, followed by each source's `NNNN_lower_snake_name.sql` sequence. SQLite and PostgreSQL directories for a module must expose matching logical IDs.

Migration execution and Module Sync are separate operations. Migrations establish append-only physical schema history; `pnpm modules:sync` reviews and accepts release metadata in `business_module_registry_state` and `business_module_registry_entries`. Module removal never reverses migrations or drops retained module tables/data.

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

## Migration History Contract

`schema_migrations` records `name`, `source`, SHA-256 `checksum`, and UTC `applied_at`. Base history names retain their filenames. Module history IDs use `module:<moduleCode>:<logicalId>`.

Applied migrations are append-only. A changed source or checksum fails migration execution. The Phase 1 history shape was introduced while the project was still in internal development, so old development/test databases must be rebuilt explicitly. Ordinary migration commands never drop or reset a database and fail with a reset instruction when they detect the legacy history shape.

Generated build artifacts expose migration IDs, source ownership, and checksums, but never SQL text.
