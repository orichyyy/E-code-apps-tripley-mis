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

## Backend Core Progress

The backend core goal has partial implementation progress:

- Added Drizzle schema definitions for SQLite and PostgreSQL covering users, organizations, roles, user-organization-role bindings, permissions, role permissions, menus, route metadata, API permission metadata, menu/API bindings, auth sessions, refresh tokens, and system initialization state.
- Added dialect-specific SQL migration files for SQLite and PostgreSQL for the backend core foundation. No SQL Server schema or migrations were added.
- Added organization materialized path helpers for the confirmed int64 design: `encodeOrgPath`, `decodeOrgPath`, `getOrgPathRange`, `isDescendantPath`, and sibling segment allocation.
- Added backend security utilities for API ID string serialization, UTC time helpers, configurable password complexity, scrypt password hashing, refresh-token generation/hash support, and HS256 JWT access tokens.
- Added an in-memory `CacheAdapter` implementation and a permission-cache boundary with invalidation tests.
- Added base permission, route, and menu manifests for the current backend-core surface, plus API endpoints for `/api/permissions/manifest`, `/api/routes/manifest`, and `/api/menus/tree`.
- Added typed API request schemas for initialization, auth, organization, user, user-organization-role, role, and permission mutation requests.
- Added a replaceable in-memory backend-core service layer for the foundation API surface. It supports first-start initialization, default organization/admin/roles/menu seed data, username/password login, refresh-token-cookie access-token refresh, logout/session revocation, online user listing, organization CRUD and disable cascade, user CRUD/status/password reset, one-role-per-user-organization assignment/removal, role CRUD/copy, and role permission updates.
- Split the in-memory backend foundation into focused auth, initialization, organization, user, and role services/routes so DB-backed repositories can replace the storage boundary later without growing a large mixed-responsibility module.
- Added stable backend API error handling for known authentication, validation, business, and system errors. Zod request failures now return `VALIDATION_INVALID_REQUEST`, and business/auth failures return their stable error codes instead of leaking raw internal errors.
- Added a base API permission metadata manifest for the implemented backend-core routes. It declares method, path, API permission code, module, log level, public/private status, and required permission where applicable. The existing `/api/permissions/manifest` endpoint now exposes this API metadata alongside the permission manifest so a later DB-backed permission sync can persist it to `api_permissions`.
- Added manifest-driven API authorization middleware for the implemented backend-core Hono routes. Public routes remain callable without a token; private routes require a Bearer access token and, where declared by the API permission metadata, the user's current-organization role must grant the required permission.
- Wired the permission cache into authorization checks and invalidates cached user/organization permission contexts when role permissions or user-organization-role bindings change.
- Added the current-user `/api/auth/change-password` backend flow. New admin-created users and administrator password resets require password change before ordinary private APIs; password changes validate the old password, enforce the configured password policy, clear the forced-change flag, advance password expiration, and increment token version so old access tokens are invalidated.
- Moved password policy into backend core configuration while preserving the confirmed default minimum 8 characters, letters plus numbers, and 365-day periodic password change cycle.

This is not yet the complete backend core foundation. DB-backed repositories, executable migrations, PostgreSQL integration tests, durable initialization/auth/session persistence, and finalized CSRF protection still depend on the unresolved implementation questions.

## Recommended Next Goals

1. Confirm the concrete SQLite driver and PostgreSQL test provisioning approach.
2. Wire real SQLite and PostgreSQL Drizzle connections plus executable migrations.
3. Implement DB-backed repositories for initialization, auth/session, users, organizations, roles, permissions, menus, and route/API permission metadata.
4. Implement initialization setup and seed CLI using the DB-backed repositories.
5. Implement auth/session endpoints and core CRUD routes with PostgreSQL integration tests.
