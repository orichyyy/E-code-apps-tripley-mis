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

Run the complete local quality gate:

```bash
pnpm verify
```

`pnpm verify` runs format, lint, typecheck, unit/integration tests, SQLite and PostgreSQL migrations, local smoke, and production build. Set `TEST_DATABASE_URL` or `DATABASE_URL` before running it; the PostgreSQL migration step requires one of those variables.

Individual validation commands:

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm db:migrate
pnpm db:migrate:postgresql
pnpm smoke:local
pnpm build
```

`pnpm db:migrate` runs local SQLite migrations using `better-sqlite3`. Set `TEST_DATABASE_URL` or `DATABASE_URL` to run PostgreSQL migrations as part of the same command; `pnpm db:migrate:postgresql` requires one of those variables.

For a persistent DB-backed local SQLite run, set variables in the shell that starts the apps. `.env.example` is a reference checklist; the current runtime reads process environment variables directly.
When using root `pnpm` scripts, relative SQLite paths such as `file:./data/web-admin-base.sqlite` resolve from the original command directory, so run the commands from the repository root.

The simplest startup path on Windows PowerShell is:

```powershell
pnpm dev:local
```

This script sets the local SQLite environment, applies migrations, seeds the administrator, starts API/Web/Worker, and prints the browser URL and login account.

Equivalent manual setup:

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

## CI Verification

The repository includes `.github/workflows/verify.yml` for GitHub Actions. It starts PostgreSQL 16, sets `TEST_DATABASE_URL`, installs dependencies with `pnpm install --frozen-lockfile`, installs Playwright Chromium, and runs:

```bash
pnpm verify
```

The CI path intentionally uses the same verification command as local development. Optional external integrations stay disabled in normal verification. S3 compatibility has a separate manually triggered workflow.

## Optional Redis and RabbitMQ Adapter Tests

Redis and RabbitMQ are optional adapter drivers. They are not required for `pnpm dev:local`, `pnpm smoke:local`, or `pnpm verify`.

To run their Docker-backed development tests:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-optional-integrations.ps1
$env:REDIS_URL = "redis://127.0.0.1:6379"
$env:RABBITMQ_URL = "amqp://guest:guest@127.0.0.1:5672"
pnpm test:optional-integrations
```

The script starts `tripley-redis-dev` with `redis:8.8.0-alpine` and `tripley-rabbitmq-dev` with `rabbitmq:4.3.2-alpine`. Both containers avoid persistent volumes by default and use small memory limits for development.

To opt into the external drivers at runtime:

```powershell
$env:CACHE_DRIVER = "redis"
$env:QUEUE_DRIVER = "rabbitmq"
$env:REDIS_URL = "redis://127.0.0.1:6379"
$env:RABBITMQ_URL = "amqp://guest:guest@127.0.0.1:5672"
```

`CACHE_DRIVER=database` uses the existing `cache_entries` table for backend permission-cache storage. `QUEUE_DRIVER=rabbitmq` routes adapter-enqueued jobs such as in-app notification dispatch through RabbitMQ, while the worker still processes database-backed scheduled and import/export tasks through the durable database queue.

Stop them when not needed:

```powershell
docker stop tripley-redis-dev tripley-rabbitmq-dev
```

## Optional S3-Compatible Storage Test

Start the pinned, disposable RustFS compatibility backend and run the AWS SDK v3 suite:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/rustfs-dev.ps1
pnpm test:s3-integration
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/rustfs-dev.ps1 -Action Stop
```

The container binds only `127.0.0.1:9000`, disables the Console, uses disposable development credentials and an isolated volume, and starts with a 256 MB memory limit. The script removes the volume on stop unless `-PreserveData` is supplied for diagnosis.

To run API and worker with S3 as the active driver, set `FILE_STORAGE_DRIVER=s3`, `S3_REGION`, `S3_BUCKET`, and any required endpoint/credentials. `S3_AUTO_CREATE_BUCKET=true` is allowed only for explicit development/test use. Local remains the default, and existing files continue to use their recorded driver after switching.

```powershell
$env:FILE_STORAGE_DRIVER = "s3"
$env:S3_ENDPOINT = "http://127.0.0.1:9000"
$env:S3_REGION = "us-east-1"
$env:S3_BUCKET = "web-admin-base-dev"
$env:S3_OBJECT_PREFIX = "development/"
$env:S3_FORCE_PATH_STYLE = "true"
$env:S3_AUTO_CREATE_BUCKET = "true"
$env:S3_ACCESS_KEY_ID = "webadmin"
$env:S3_SECRET_ACCESS_KEY = "webadmin-development-secret"
```

## Local Acceptance

Use `docs/local_run_acceptance.md` when you need a reproducible local run walkthrough. It combines the automated `pnpm verify` / `pnpm smoke:local` checks with a manual browser checklist for the implemented admin pages.

## Local Smoke

Run a repeatable SQLite DB-backed local smoke check:

```bash
pnpm smoke:local
```

The script runs SQLite migrations, seeds the default administrator, starts API/Web/Worker, verifies live API endpoints through the Vite proxy, and runs a browser login/navigation check. By default it uses:

- API: `http://localhost:3100`
- Web: `http://localhost:5174`
- SQLite: `data/local-smoke.sqlite`
- Admin: `admin` / `Admin1234`

The browser check first tries system Chrome and Edge, then falls back to Playwright's bundled Chromium. If no browser is available, install one or run:

```bash
pnpm exec playwright install chromium
```

Optional overrides:

```powershell
$env:SMOKE_API_PORT = "3101"
$env:SMOKE_WEB_PORT = "5175"
$env:SMOKE_ADMIN_PASSWORD = "Admin1234"
$env:SMOKE_KEEP_DATA = "1"
pnpm smoke:local
```

SMTP email sending is disabled by default. For local SMTP testing, point the API at a local SMTP capture tool:

```powershell
$env:SMTP_ENABLED = "true"
$env:SMTP_HOST = "127.0.0.1"
$env:SMTP_PORT = "1025"
$env:SMTP_SECURE = "false"
$env:SMTP_FROM = "no-reply@example.com"
$env:SMTP_ALLOW_INSECURE_LOCALHOST = "true"
```

Use the pinned disposable Mailpit environment for compatibility testing:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/mailpit-dev.ps1
pnpm test:smtp-integration
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/mailpit-dev.ps1 -Action Stop
```

The certificate and private key under `scripts/mailpit/` are committed, self-signed test fixtures for loopback Mailpit only. Never reuse them for a shared or production SMTP endpoint.

Reliable delivery additionally requires `EMAIL_DELIVERY_ENABLED=true`, a JSON `EMAIL_CONTENT_KEYS` keyring containing canonical Base64 32-byte AES keys, and `EMAIL_CONTENT_ACTIVE_KEY_ID`. Set the same values for API and Worker. `SMTP_ENABLED=false` may intentionally leave encrypted work pending without consuming attempts. Use `pnpm email:content-keys:migrate` before removing an old key and add `--apply` only after reviewing scan output.

## API Docs

Start the API and open:

```text
/api/openapi.json
```

The OpenAPI document covers implemented APIs only.

## Optional Outbound Webhook Delivery

Outbound delivery is disabled by default. Generate a disposable development key and set the same values for API and Worker:

```powershell
$key = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
$env:WEBHOOK_SECRET_KEYS = '{"dev":"' + $key + '"}'
$env:WEBHOOK_SECRET_ACTIVE_KEY_ID = 'dev'
$env:WEBHOOK_DELIVERY_ENABLED = 'true'
$env:WORKER_POLL_INTERVAL_MS = '1000'
```

Production-style destinations require HTTPS. A local loopback receiver may be used only in development/test with `WEBHOOK_ALLOW_INSECURE_LOCALHOST=true`. Run `pnpm test:webhook-integration` for the repeatable local receiver, retry, cleanup, and optional PostgreSQL claim checks.

Before enabling delivery for legacy subscription data, run `pnpm webhook:secrets:migrate` and review the counts. Apply encryption/rotation with `pnpm webhook:secrets:migrate -- --apply`. The command reports record IDs and states only; it does not print secrets or ciphertext.
