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
pnpm lint
pnpm typecheck
pnpm test
pnpm db:migrate
pnpm build
```

`pnpm db:migrate` runs SQLite migrations with `better-sqlite3` by default. PostgreSQL migrations run when `TEST_DATABASE_URL` or `DATABASE_URL` is provided; `pnpm db:migrate:postgresql` requires one of those variables.

Set `BACKEND_CORE_STORE=database` with `DATABASE_URL` to run DB-backed backend-core persistence, infrastructure services, and system-management services. PostgreSQL remains the supported deployment database; SQLite remains usable for local/demo compatibility.

The worker uses the same `DATABASE_DIALECT` and `DATABASE_URL` settings for durable queue and scheduler processing. Set `WORKER_POLL_INTERVAL_MS` to a positive value to poll continuously; the default `0` keeps polling disabled for explicit `runOnce()` execution and tests.

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

- `docs/local_development_guide.md`
- `docs/deployment_guide.md`
- `docs/database_migration_guide.md`
- `docs/adapter_extension_guide.md`
- `docs/business_module_extension_guide.md`
- `docs/permission_extension_guide.md`
- `docs/troubleshooting_guide.md`
- `docs/known_gaps.md`
