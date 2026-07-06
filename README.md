# Web Admin Base System

Reusable multi-organization admin-system foundation built as a pnpm monorepo.

## Applications and Packages

- `apps/api`: Node.js Hono API with request IDs, auth/session/user/organization/role/permission/menu foundations, personal profile/preferences APIs, system configuration, dictionaries, i18n messages, file upload/download/preview metadata APIs, announcements, webhook subscription APIs, OpenAPI JSON, and manifest-based API authorization.
- `apps/web`: React Vite SPA admin shell using TanStack Router, TanStack Query, TanStack Form, Zod, Zustand, Tailwind CSS, and shadcn/ui, including personal center/settings, base file management, announcement, in-app notification, i18n message, notification template, and webhook subscription management pages.
- `apps/worker`: Node.js worker runtime wired to database queue/scheduler adapters, default in-app notification dispatch task registration, durable `runOnce`, and optional polling.
- `packages/contracts`: Zod contracts, Hono RPC boundary types, permission/route/menu/API manifests, and OpenAPI generation.
- `packages/db`: Drizzle schemas, SQLite/PostgreSQL migration files, and executable migration runners.
- `packages/adapters`: adapter interfaces plus in-memory defaults, database-backed cache/lock/queue/event-bus/rate-limit/scheduler drivers, token store, in-memory/SMTP notification channels, and local filesystem storage.
- `packages/shared`: shared constants, result types, i18n keys, and utilities.

## Commands

```bash
pnpm install
pnpm verify
```

`pnpm verify` runs the complete local quality gate:

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

Set `TEST_DATABASE_URL` or `DATABASE_URL` before running `pnpm verify`; the PostgreSQL migration step requires one of those variables.

## Project Runbooks

Start here based on the job you are doing:

- New developer: read `docs/local_development_guide.md`, then run `pnpm install` and `pnpm smoke:local` for the fastest local confidence check.
- Local operator: use `docs/local_run_acceptance.md` to run the persistent SQLite demo path and browser acceptance checklist.
- CI maintainer: use `.github/workflows/verify.yml` and keep it running the root `pnpm verify` command with PostgreSQL and Playwright Chromium available.
- Deployment operator: use `docs/deployment_guide.md` for deployment shape and `docs/deployment_acceptance.md` for the PostgreSQL-backed rollout checklist.
- Release owner: use `docs/release_readiness.md`, review `docs/known_gaps.md`, and file a record under `docs/release_readiness_records/`.
- Business module developer: use `docs/business_module_extension_guide.md` and do not add example business modules to the base system.
- Adapter extender: use `docs/adapter_extension_guide.md`; Redis, RabbitMQ, S3-compatible storage, SMS, and real outbound webhook delivery remain optional or reserved unless a dedicated goal implements them.
- Permission extender: use `docs/permission_extension_guide.md` and keep route, menu, API permission, OpenAPI, and frontend metadata aligned.
- Troubleshooter: start with `docs/troubleshooting_guide.md`, then check `docs/known_gaps.md` before treating a reserved boundary as a bug.

## CI Verification

GitHub Actions runs the same `pnpm verify` command on pushes to `main` and pull requests. The workflow starts a PostgreSQL 16 service, sets `TEST_DATABASE_URL`, installs Playwright Chromium for the browser smoke check, and keeps Redis, RabbitMQ, S3-compatible storage, SMTP, SMS, and outbound webhook delivery disabled.

For a persistent local SQLite run, use `.env.example` as the variable checklist and set the variables in the shell that starts the processes:

```powershell
$env:BACKEND_CORE_STORE = "database"
$env:DATABASE_DIALECT = "sqlite"
$env:DATABASE_URL = "file:./data/web-admin-base.sqlite"
$env:FILE_STORAGE_ROOT = "./data/files"
$env:WEB_ADMIN_SEED_ADMIN_PASSWORD = "change-me-local-1"
pnpm db:migrate
pnpm seed
pnpm dev
```

Relative SQLite paths in root `pnpm` scripts resolve from the original command directory, so run the local commands from the repository root.

`pnpm db:migrate` runs SQLite migrations with `better-sqlite3` by default. PostgreSQL migrations run when `TEST_DATABASE_URL` or `DATABASE_URL` is provided; `pnpm db:migrate:postgresql` requires one of those variables.

Set `BACKEND_CORE_STORE=database` with `DATABASE_URL` to run DB-backed backend-core persistence, infrastructure services, and system-management services. PostgreSQL remains the supported deployment database; SQLite remains usable for local/demo compatibility.

`pnpm smoke:local` is a repeatable SQLite DB-backed smoke check. It runs local migrations and seed, starts API/Web/Worker, verifies implemented base APIs through the Vite proxy, and runs a browser login/navigation check against the admin shell. It tries system Chrome/Edge first and can use Playwright's bundled Chromium after `pnpm exec playwright install chromium`.

The worker uses the same `DATABASE_DIALECT` and `DATABASE_URL` settings for durable queue and scheduler processing. Set `WORKER_POLL_INTERVAL_MS` to a positive value to poll continuously; the default `0` keeps polling disabled for explicit `runOnce()` execution and tests. Database queue jobs use stored attempts, delayed retry, stale-running recovery, and the existing `dead_letter` status when attempts are exhausted. Scheduled jobs use standard five-field cron expressions, compute `next_run_at`, and write scheduler execution logs. The default worker catalog registers in-app notification dispatch, manual `scheduled.run`, log retention cleanup, local invalid-file cleanup, CSV log export processing, and import/export result cleanup.

Local file storage uses `FILE_STORAGE_ROOT` when provided and falls back to `.web-admin-storage`. Uploads enforce the default 50 MB single-file limit, configurable with `FILE_MAX_SIZE_BYTES`, and the confirmed base whitelist.

Notification templates and webhook subscriptions are persisted for management. In-app notification creation/fan-out is available through the internal queue-backed dispatch service and worker task boundary. SMTP email sending is available as an optional configuration-driven notification channel; SMS sending, real outbound webhook delivery, and delivery retries remain reserved integrations.

Optional SMTP configuration:

```bash
SMTP_ENABLED=true
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USERNAME=optional-user
SMTP_PASSWORD=optional-password
SMTP_FROM=no-reply@example.com
```

Personal center APIs persist allowed self-profile fields and UI preferences. Avatar changes store an existing file id reference; file upload remains handled by the file management API.

## API Documentation

Implemented APIs are documented at `GET /api/openapi.json` and generated from `packages/contracts` manifests by `createOpenApiDocument()`.

The contracts build also writes `packages/contracts/generated/base-system-manifests.json`, containing permission, API permission, route, menu, and OpenAPI artifacts for review.

## Guides

- `.github/workflows/verify.yml`
- `docs/local_development_guide.md`
- `docs/local_run_acceptance.md`
- `docs/deployment_guide.md`
- `docs/deployment_acceptance.md`
- `docs/release_readiness.md`
- `docs/release_readiness_records/`
- `docs/database_migration_guide.md`
- `docs/adapter_extension_guide.md`
- `docs/business_module_extension_guide.md`
- `docs/permission_extension_guide.md`
- `docs/troubleshooting_guide.md`
- `docs/known_gaps.md`
