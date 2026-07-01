# Implementation Plan

## Implemented Foundation

This repository now has the initial monorepo foundation for the Web Admin Base System:

- `apps/web`: React Vite SPA with Tailwind CSS, shadcn/ui configuration, TanStack Router, TanStack Query, Zustand stores, and a minimal admin/login shell.
- `apps/api`: Node.js Hono API skeleton with `/api/health`, request ID middleware, typed config loading, and API tests.
- `apps/worker`: Node.js worker skeleton with config loading and a runtime boundary.
- `packages/shared`: shared constants, result types, i18n namespace constants, and utilities.
- `packages/db`: Drizzle ORM package skeleton with SQLite and PostgreSQL schema/config boundaries, migration folders, and a driver factory abstraction. No SQL Server code or SQL Server migration folders are included.
- `packages/contracts`: Zod API schemas, route metadata contracts, permission manifest contracts, OpenAPI placeholder, and Hono RPC contract placeholder.
- `packages/adapters`: interface skeletons for cache, lock, queue, event bus, rate limiting, token store, job scheduling, file storage, and notification channels.

## Development Workflow

Root scripts are available through pnpm:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Additional scripts are present for app-specific development and future database workflows:

```bash
pnpm dev
pnpm dev:api
pnpm dev:web
pnpm dev:worker
pnpm db:generate
pnpm db:migrate:sqlite
pnpm db:migrate:postgresql
```

## Intentional Non-Implementation

This foundation does not implement full authentication, RBAC, organization management, logging, notifications, file management, import/export, scheduler behavior, SQL Server support, Bun/Deno support, or any example business module.

The SQLite concrete driver is intentionally not selected in this foundation because the design spec marks that package choice as unspecified. The DB package exposes a factory boundary where the concrete driver can be added after that decision is confirmed.

## Recommended Next Goals

1. Implement the API core foundation: structured response envelope, request ID propagation, error handling, config layering, and observability placeholders.
2. Implement the database foundation: confirmed SQLite driver, PostgreSQL connection, Drizzle schema baseline, migrations, seed framework, and organization path helper tests.
3. Implement adapter drivers and contract tests, starting with in-memory adapters and database-backed extension points.
4. Implement authentication/session foundation only after API, DB, and adapter boundaries are validated.
