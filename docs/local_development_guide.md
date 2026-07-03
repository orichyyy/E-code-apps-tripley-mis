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

For DB-backed local API behavior:

```bash
set BACKEND_CORE_STORE=database
set DATABASE_DIALECT=sqlite
set DATABASE_URL=file:./data/web-admin-base.sqlite
set FILE_STORAGE_ROOT=./data/files
set FILE_MAX_SIZE_BYTES=52428800
pnpm db:migrate
pnpm dev:api
```

For PostgreSQL integration testing, set `TEST_DATABASE_URL` before running `pnpm test`.

SMTP email sending is disabled by default. For local SMTP testing, point the API at a local SMTP capture tool:

```bash
set SMTP_ENABLED=true
set SMTP_HOST=127.0.0.1
set SMTP_PORT=1025
set SMTP_SECURE=false
set SMTP_FROM=no-reply@example.com
```

## API Docs

Start the API and open:

```text
/api/openapi.json
```

The OpenAPI document covers implemented APIs only.
