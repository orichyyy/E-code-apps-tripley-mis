# Local Development Guide

## Prerequisites

- Node.js only for backend/runtime execution.
- pnpm, matching the root `packageManager` field.

## Setup

```bash
pnpm install
pnpm dev
```

Individual apps:

```bash
pnpm dev:api
pnpm dev:web
pnpm dev:worker
```

## Validation

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

`pnpm db:migrate` runs local SQLite migrations using `better-sqlite3`. Set `TEST_DATABASE_URL` or `DATABASE_URL` to run PostgreSQL migrations as part of the same command; `pnpm db:migrate:postgresql` requires one of those variables.

For a persistent DB-backed local SQLite run, set variables in the shell that starts the apps. `.env.example` is a reference checklist; the current runtime reads process environment variables directly.
When using root `pnpm` scripts, relative SQLite paths such as `file:./data/web-admin-base.sqlite` resolve from the original command directory, so run the commands from the repository root.

```powershell
$env:BACKEND_CORE_STORE = "database"
$env:DATABASE_DIALECT = "sqlite"
$env:DATABASE_URL = "file:./data/web-admin-base.sqlite"
$env:FILE_STORAGE_ROOT = "./data/files"
$env:FILE_MAX_SIZE_BYTES = "52428800"
$env:VITE_API_PROXY_TARGET = "http://localhost:3000"
$env:WEB_ADMIN_SEED_ADMIN_PASSWORD = "change-me-local-1"
pnpm db:migrate
pnpm seed
pnpm dev
```

Run the worker against the same local database when you want durable queue/scheduler jobs to execute:

```powershell
$env:DATABASE_DIALECT = "sqlite"
$env:DATABASE_URL = "file:./data/web-admin-base.sqlite"
$env:WORKER_POLL_INTERVAL_MS = "1000"
pnpm dev:worker
```

`WORKER_POLL_INTERVAL_MS=0` disables continuous polling and is useful for tests or one-shot `runOnce()` usage.
Scheduled jobs use standard five-field cron expressions and persist their computed `next_run_at` values in the configured local database. Queue retries and stale-running recovery also use the durable `queue_jobs` table, so run migrations before starting the worker.

For PostgreSQL integration testing, set `TEST_DATABASE_URL` before running `pnpm test` or `pnpm db:migrate:postgresql`.

SMTP email sending is disabled by default. For local SMTP testing, point the API at a local SMTP capture tool:

```powershell
$env:SMTP_ENABLED = "true"
$env:SMTP_HOST = "127.0.0.1"
$env:SMTP_PORT = "1025"
$env:SMTP_SECURE = "false"
$env:SMTP_FROM = "no-reply@example.com"
```

## API Docs

Start the API and open:

```text
/api/openapi.json
```

The OpenAPI document covers implemented APIs only.
