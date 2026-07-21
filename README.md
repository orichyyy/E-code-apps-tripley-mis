# Web Admin Base System

Reusable multi-organization admin-system foundation built as a pnpm monorepo.

## Applications and Packages

- `apps/api`: Node.js Hono API with request IDs, auth/session/user/organization/role/permission/menu foundations, Business Module Registry lifecycle/Admin Sync, personal profile/preferences APIs, system configuration, dictionaries, i18n messages, file APIs, organization-targeted announcements, Webhook subscription/delivery-history APIs, OpenAPI JSON, and manifest-based authorization.
- `apps/web`: React Vite SPA admin shell using TanStack Router, TanStack Query, TanStack Form, Zod, Zustand, Tailwind CSS, and shadcn/ui, including Business Module Registry sync, target-aware announcement management, Current Announcements, and safe Webhook/email delivery history.
- `apps/worker`: Node.js worker runtime wired to database queue/scheduler adapters, durable Webhook Outbox fan-out/delivery, cleanup tasks, durable `runOnce`, and optional polling.
- `packages/contracts`: Zod contracts, Hono RPC boundary types, permission/route/menu/API manifests, serializable Business Module definitions, and OpenAPI generation.
- `packages/module-sdk`: static Business Module registry composition, deterministic hashes, conformance tooling, and fail-closed data/field permission enforcement.
- `packages/db`: Drizzle schemas, SQLite/PostgreSQL migrations/runners, module migration sources, and parameterized neutral-predicate translation.
- `packages/adapters`: adapter interfaces plus in-memory defaults, database-backed infrastructure drivers, optional Redis/RabbitMQ drivers, token store, notification channels, atomic local file storage, and optional AWS SDK v3 S3-compatible storage.
- `packages/shared`: shared constants, result types, i18n keys, and utilities.

## Commands

```bash
pnpm install
pnpm verify
```

`pnpm verify` runs the complete local quality gate:

```bash
pnpm format
pnpm modules:check
pnpm lint
pnpm typecheck
pnpm test
pnpm db:migrate
pnpm db:migrate:postgresql
pnpm smoke:local
pnpm build
```

Set `TEST_DATABASE_URL` or `DATABASE_URL` before running `pnpm verify`; the PostgreSQL migration step requires one of those variables.

`pnpm modules:check` validates the explicit API/Web/Worker/database registries without a database or external service. It writes machine-readable diagnostics to `.tmp/business-module-conformance.json`. The production Business Module registries are intentionally empty until a real module is added in a later repository goal; synthetic modules are test fixtures only.

`pnpm modules:sync` prints the read-only Module Sync Plan for the configured database. Apply a reviewed plan with `pnpm modules:sync --apply --expected-registry-hash=<sha256> --confirmed`, or use the permissioned `/system/modules` page. Ordinary API/Worker startup never applies release metadata automatically.

## Project Runbooks

Start here based on the job you are doing:

- New developer: read `docs/local_development_guide.md`, then run `pnpm install` and `pnpm smoke:local` for the fastest local confidence check.
- Local operator: use `docs/local_run_acceptance.md` to run the persistent SQLite demo path and browser acceptance checklist.
- CI maintainer: use `.github/workflows/verify.yml` and keep it running the root `pnpm verify` command with PostgreSQL and Playwright Chromium available.
- Deployment operator: use `docs/deployment_guide.md` for deployment shape and `docs/deployment_acceptance.md` for the PostgreSQL-backed rollout checklist.
- Release owner: use `docs/release_readiness.md`, review `docs/known_gaps.md`, and file a record under `docs/release_readiness_records/`.
- Business module developer: use `docs/business_module_extension_guide.md`, run `docs/business_module_acceptance.md`, and do not add example business modules to the base system.
- Adapter extender: use `docs/adapter_extension_guide.md`; Redis, RabbitMQ, S3-compatible storage, SMTP, and outbound Webhook delivery are optional and disabled unless configured. SMS remains reserved.
- Permission extender: use `docs/permission_extension_guide.md` and keep route, menu, API permission, OpenAPI, and frontend metadata aligned.
- Troubleshooter: start with `docs/troubleshooting_guide.md`, then check `docs/known_gaps.md` before treating a reserved boundary as a bug.

## CI Verification

GitHub Actions runs the same `pnpm verify` command on pushes to `main` and pull requests. Normal verification keeps external adapters disabled. The manually triggered `S3 Compatibility` workflow tests the generic AWS SDK v3 driver against pinned RustFS without adding RustFS to push CI.

For a persistent local SQLite run, use `.env.example` as the variable checklist and set the variables in the shell that starts the processes:

```powershell
pnpm dev:local
```

The script applies SQLite migrations, seeds the default administrator, starts API/Web/Worker, and prints the browser URL and login account. The equivalent manual commands are:

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

S3-compatible storage is opt-in with `FILE_STORAGE_DRIVER=s3`. API and worker share the validated `S3_*` settings, while existing records continue to use their persisted local or S3 object location. S3 downloads remain private: the API authorizes the request and returns a short-lived presigned redirect. See `docs/local_development_guide.md` for the disposable RustFS compatibility test. RustFS is not the selected production provider.

Notification templates and Webhook subscriptions are persisted for management. Reliable email uses encrypted delivery snapshots, durable attempts, bounded retries, stable Message IDs, terminal content purge, and read-only safe history. Outbound Webhook delivery uses a transactional database Outbox, durable attempts, encrypted secrets, HMAC signatures, and SSRF-safe HTTP delivery. Both are disabled by default. SMS sending remains reserved.

Announcements support system or minimal multi-Organization subtree targets, draft-only lifecycle changes, immediate publication, optional UTC expiration, and dynamic visibility through the authenticated current Organization. The management Catalog and top-bar Current Announcements view are separate. Publishing does not fan out recipient rows or trigger in-app, email, SMS, or Webhook delivery.

The Business Module extension foundation is complete across static registration, Admin Sync/activation, executable data/field permissions, and constructor-injected Capability Ports. Module code can use declared Operation Events, typed errors, Managed File references, asynchronous CSV tasks, Domain/Notification Events, and bounded background/scheduled jobs while preserving actor/Organization/trace context. Production registries intentionally contain no Business Modules; see `docs/business_module_extension_guide.md` and ADRs 0005-0007 before adding one.

Webhook verification commands:

```powershell
pnpm webhook:secrets:migrate
pnpm webhook:secrets:migrate -- --apply
pnpm test:webhook-integration
```

Configure both API and Worker with the same `WEBHOOK_*` values. `WEBHOOK_SECRET_KEYS` is a JSON object of Base64-encoded 32-byte keys; `WEBHOOK_SECRET_ACTIVE_KEY_ID` selects the write key. See `docs/local_development_guide.md` and `docs/webhook_delivery_design.md`.

Optional Redis and RabbitMQ adapter tests:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-optional-integrations.ps1
$env:REDIS_URL = "redis://127.0.0.1:6379"
$env:RABBITMQ_URL = "amqp://guest:guest@127.0.0.1:5672"
pnpm test:optional-integrations
```

These integrations stay disabled for default local startup, CI, and deployment acceptance unless explicitly configured with runtime driver environment variables.

Optional runtime driver selection:

```powershell
$env:CACHE_DRIVER = "redis"
$env:QUEUE_DRIVER = "rabbitmq"
$env:REDIS_URL = "redis://127.0.0.1:6379"
$env:RABBITMQ_URL = "amqp://guest:guest@127.0.0.1:5672"
```

Worker runtime keeps the database durable queue and scheduler active even when `QUEUE_DRIVER=rabbitmq`, so existing scheduled tasks, import/export processing, and log export paths continue to work.

Optional SMTP configuration:

```bash
SMTP_ENABLED=true
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USERNAME=optional-user
SMTP_PASSWORD=optional-password
SMTP_FROM=no-reply@example.com
SMTP_TIMEOUT_MS=10000
SMTP_ALLOW_INSECURE_LOCALHOST=false
EMAIL_DELIVERY_ENABLED=true
EMAIL_CONTENT_KEYS={"primary":"<canonical-base64-32-byte-key>"}
EMAIL_CONTENT_ACTIVE_KEY_ID=primary
```

For disposable local SMTP acceptance, run `scripts/mailpit-dev.ps1`, then `pnpm test:smtp-integration`. Mailpit is bound to loopback and is not required by normal tests or push CI. The committed self-signed certificate and key under `scripts/mailpit/` are test fixtures only.

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
- `docs/base_system_status_matrix.md`
- `docs/database_migration_guide.md`
- `docs/adapter_extension_guide.md`
- `docs/business_module_extension_guide.md`
- `docs/permission_extension_guide.md`
- `docs/troubleshooting_guide.md`
- `docs/known_gaps.md`
