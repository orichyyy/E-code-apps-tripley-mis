# Web Admin Base System

Reusable multi-organization admin-system foundation built as a pnpm monorepo.

## Applications and Packages

- `apps/api`: Node.js Hono API with request IDs, auth/session/user/organization/role/permission/menu foundations, system configuration, dictionaries, i18n messages, announcements, webhook subscription APIs, OpenAPI JSON, and manifest-based API authorization.
- `apps/web`: React Vite SPA admin shell using TanStack Router, TanStack Query, TanStack Form, Zod, Zustand, Tailwind CSS, and shadcn/ui, including base announcement, in-app notification, i18n message, notification template, and webhook subscription management pages.
- `apps/worker`: Node.js worker runtime with queue-task/scheduled-task registration, durable queue/scheduler `runOnce`, and optional polling boundaries.
- `packages/contracts`: Zod contracts, Hono RPC boundary types, permission/route/menu/API manifests, and OpenAPI generation.
- `packages/db`: Drizzle schemas, SQLite/PostgreSQL migration files, and executable migration runners.
- `packages/adapters`: adapter interfaces plus in-memory defaults, database-backed cache/lock/queue/event-bus/rate-limit/scheduler drivers, token store, notifications, and local filesystem storage.
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

Notification templates and webhook subscriptions are persisted for management, but SMTP/SMS sending, real outbound webhook delivery, and retries remain optional/reserved integrations until their package and delivery contracts are configured.

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
