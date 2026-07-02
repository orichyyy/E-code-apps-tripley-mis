# Web Admin Base System

Reusable multi-organization admin-system foundation built as a pnpm monorepo.

## Applications and Packages

- `apps/api`: Node.js Hono API with request IDs, auth/session/user/organization/role/permission/menu foundations, OpenAPI JSON, and manifest-based API authorization.
- `apps/web`: React Vite SPA admin shell using TanStack Router, TanStack Query, TanStack Form, Zod, Zustand, Tailwind CSS, and shadcn/ui.
- `apps/worker`: Node.js worker skeleton.
- `packages/contracts`: Zod contracts, Hono RPC boundary types, permission/route/menu/API manifests, and OpenAPI generation.
- `packages/db`: Drizzle schemas and SQLite/PostgreSQL migration files.
- `packages/adapters`: adapter interfaces and selected in-memory drivers.
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

`pnpm db:migrate` is intentionally blocked until the unresolved database driver/provisioning questions in `docs/implementation_questions.md` are answered. See `docs/known_gaps.md`.

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
