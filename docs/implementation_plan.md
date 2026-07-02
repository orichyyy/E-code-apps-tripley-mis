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
- Aligned permission and API-permission Drizzle schemas/migrations with the manifest-backed metadata records, including module, required permission, and public/private API metadata.
- Added organization materialized path helpers for the confirmed int64 design: `encodeOrgPath`, `decodeOrgPath`, `getOrgPathRange`, `isDescendantPath`, and sibling segment allocation.
- Tightened organization segment allocation so exhausted root/child sibling ranges translate to a stable business error instead of an internal error.
- Added organization maximum-depth configuration with `GET /api/organizations/config/depth` and `PATCH /api/organizations/config/depth`. The configurable limit defaults to 8 and is bounded by the confirmed 8-level materialized-path capacity.
- Added backend security utilities for API ID string serialization, UTC time helpers, configurable password complexity, scrypt password hashing, refresh-token generation/hash support, and HS256 JWT access tokens.
- Wired backend-core security settings into typed API configuration and `.env.example`, including JWT settings, access/refresh token TTLs, failed-login lock settings, password complexity, and periodic password-change days.
- Added an in-memory `CacheAdapter` implementation and a permission-cache boundary with invalidation tests.
- Added base permission, route, and menu manifests for the current backend-core surface, plus API endpoints for `/api/permissions/manifest`, `/api/routes/manifest`, and `/api/menus/tree`.
- Added typed API request schemas for initialization, auth, organization, user, user-organization-role, role, and permission mutation requests.
- Aligned organization create/update contracts and in-memory records with the confirmed optional manager, phone, email, and address fields already present in the SQLite/PostgreSQL schemas.
- Aligned user create/update contracts and in-memory records with the confirmed optional avatar file, gender, and employee number fields already present in the SQLite/PostgreSQL schemas.
- Added a replaceable in-memory backend-core service layer for the foundation API surface. It supports first-start initialization, default organization/admin/roles/menu seed data, username/password login, refresh-token-cookie access-token refresh, logout/session revocation, online user listing, organization CRUD and disable cascade, user CRUD/status/password reset, one-role-per-user-organization assignment/removal, role CRUD/copy, and role permission updates.
- Split the in-memory backend foundation into focused auth, initialization, organization, user, and role services/routes so DB-backed repositories can replace the storage boundary later without growing a large mixed-responsibility module.
- Added `pnpm seed` / API workspace seed command support for command-line initialization through the backend-core initialization service. The seed command reads `WEB_ADMIN_SEED_*` environment variables, requires the admin password from the environment, creates the same default organization/admin/roles/permissions/menus/routes as the wizard path on a fresh service, and treats reruns against an initialized service as an idempotent manifest/built-in-role sync.
- Added stable backend API error handling for known authentication, validation, business, and system errors. Zod request failures now return `VALIDATION_INVALID_REQUEST`, and business/auth failures return their stable error codes instead of leaking raw internal errors.
- Added a base API permission metadata manifest for the implemented backend-core routes. It declares method, path, API permission code, module, log level, public/private status, and required permission where applicable. The existing `/api/permissions/manifest` endpoint now exposes this API metadata alongside the permission manifest so a later DB-backed permission sync can persist it to `api_permissions`.
- Added contract coverage ensuring API permission metadata only references declared base permission codes.
- Added manifest-driven API authorization middleware for the implemented backend-core Hono routes. Public routes remain callable without a token; private routes require a Bearer access token and, where declared by the API permission metadata, the user's current-organization role must grant the required permission.
- Added in-memory permission and API-permission metadata records seeded during initialization and refreshed idempotently by `POST /api/permissions/sync`; `/api/permissions` now returns initialized permission records with API JSON string IDs while `/api/permissions/manifest` remains the generated manifest preview.
- Aligned permission records with confirmed manifest metadata by recording `source` and deterministic `manifest_hash` values for base manifest permissions in the in-memory model and SQLite/PostgreSQL schemas/migrations.
- Aligned permission records with confirmed `resource` and `action` metadata by deriving those fields from base permission codes such as `user:view` during manifest sync and persisting the same columns in SQLite/PostgreSQL schemas/migrations.
- Wired the permission cache into authorization checks and invalidates cached user/organization permission contexts when role permissions or user-organization-role bindings change.
- Added the current-user `/api/auth/change-password` backend flow. New admin-created users and administrator password resets require password change before ordinary private APIs; password changes validate the old password, enforce the configured password policy, clear the forced-change flag, advance password expiration, and increment token version so old access tokens are invalidated.
- Moved password policy into backend core configuration while preserving the confirmed default minimum 8 characters, letters plus numbers, and 365-day periodic password change cycle.
- Added session-bound access token claims and `/api/context/current-organization` switching. Switching verifies the user-organization binding, rejects disabled organizations, updates the active session's current organization, returns a replacement access token, and returns refreshed permission/menu context for the selected organization. Revoked sessions and stale organization tokens are now rejected during access-token authentication.
- Added `/api/auth/me` for current user context. It returns the public user profile, active session, current organization, enabled selectable organizations, current permission codes, filtered menus, and password-change requirement status, and remains available while a forced password change is pending.
- Added PRD-compatible aliases for existing context behavior: `POST /api/auth/current-organization` switches the current organization and `GET /api/permissions/effective` returns the current effective permission context.
- Added `GET /api/context/organizations` for the current user's enabled organization selector context, with API permission metadata and route coverage.
- Added a concrete in-memory `TokenStoreAdapter` and wired refresh-token store, lookup, and session revocation through the token-store boundary. The existing in-memory refresh-token records remain the current backing-table representation until DB-backed repositories are unblocked.
- Added login-session token-version snapshots to the in-memory auth session model, SQLite/PostgreSQL Drizzle schemas, and SQL migrations. Access-token validation, refresh-token exchange, and online-user listing now reject stale sessions whose snapshot no longer matches the user's current token version.
- Added login-session status tracking (`active`, `revoked`, `expired`) to the in-memory auth session model, SQLite/PostgreSQL Drizzle schemas, and SQL migrations. Login creates active sessions, logout marks sessions revoked, expiry checks can mark sessions expired, and online-user listing only returns active sessions.
- Tightened user disablement so disabling an account increments the user token version. Old access and refresh tokens remain invalid after the account is later re-enabled.
- Tightened account lock behavior so administrator locks without an expiration deny login until administrator unlock, while configured failed-login locks still use `lockedUntil` for timed release. Unlocking clears failed-login counters and lock expiration.
- Tightened user update validation so administrator edits preserve unique username, email, and phone values and cannot set a disabled organization as the user's primary organization.
- Added route coverage for the historical disabled-organization write rule: disabled organizations reject new users and new user-organization-role bindings while existing historical records remain queryable.
- Added route coverage for the disabled-role assignment rule: disabled roles reject new users and new user-organization-role bindings.
- Aligned in-memory user and organization API records with the existing schema audit fields by recording authenticated `created_by` and `updated_by` actors on administrator create/update/status/reset/delete flows.
- Tightened user-organization-role binding removal to soft delete bindings with `is_deleted`, `deleted_at`, and `deleted_by`, and aligned the SQLite/PostgreSQL schemas and migrations with that lifecycle.
- Aligned user-organization-role bindings with the confirmed `is_primary` and `status` fields in the in-memory model and SQLite/PostgreSQL schemas/migrations; permission and auth checks now treat only enabled, non-deleted bindings as active while cache invalidation still clears stale binding contexts.
- Tightened primary-organization integrity so administrator updates can only select an organization where the user already has an active binding, and the current primary organization binding cannot be removed.
- Tightened core soft-delete endpoints so organization, user, role, menu, and user-organization-role binding removals record the authenticated actor in `deleted_by`.
- Tightened organization and role update validation so administrator edits cannot duplicate existing organization codes or role codes.
- Aligned role and user-organization-role metadata with the confirmed design fields by adding built-in role flags, reserved role data-scope identifiers, role audit actors, and binding audit actors to the in-memory model and SQLite/PostgreSQL schemas/migrations.
- Wired the confirmed role `description` field through role create/update/copy contracts, in-memory records, initialization seed data, and route coverage while retaining existing `remark` compatibility.
- Aligned role-permission records with the confirmed `effect` and `updated_at` fields. Existing role permission APIs write allow-effect records, copy preserves the effect metadata, and permission resolution only grants allow-effect records.
- Tightened role-change permission behavior so disabled/deleted assigned roles no longer grant permissions, and role update/delete operations invalidate affected user permission-cache entries.
- Tightened role copy code generation to allocate deterministic next-available copy codes instead of timestamp-derived codes.
- Added route coverage proving role copy creates a new role and preserves the copied permission configuration.
- Added `GET /api/roles/:id/permissions` to read a role's configured permission codes, with API permission metadata and route coverage.
- Added `GET /api/users/:id/organizations` to read a user's organization-role bindings, with API permission metadata and route coverage.
- Added PRD-compatible API permission identifier endpoints `GET /api/permissions/api` and `POST /api/permissions/api/sync` over the existing manifest-backed API permission metadata service, guarded by API permission metadata and route coverage.
- Added managed menu records seeded during initialization, moved `/api/menus/tree` to the backend core service, and added `POST /api/menus`, `PATCH /api/menus/:id`, and `DELETE /api/menus/:id` with API permission metadata and route coverage.
- Aligned managed menus with the confirmed `visible` field in contracts, in-memory records, SQLite/PostgreSQL schemas/migrations, and permission-context filtering. Hidden menus remain manageable but are omitted from returned menu context.
- Tightened organization, user, and role detail endpoints so missing records return stable `ORGANIZATION_NOT_FOUND`, `USER_NOT_FOUND`, and `ROLE_NOT_FOUND` errors instead of empty successful responses.
- Added `GET /api/context/permissions` for the current RBAC/menu permission context and clears cached permission contexts when managed menus change.
- Added route metadata records seeded during initialization, moved `/api/routes/manifest` to the backend core service, and added `POST /api/routes/sync` as the admin-confirmed route manifest synchronization placeholder with API permission metadata and route coverage.
- Aligned route metadata records with the confirmed route manifest metadata fields by recording `metadata_json` and deterministic `manifest_hash` values in the in-memory model and SQLite/PostgreSQL schemas/migrations.
- Added `POST /api/permissions/sync` as the admin-confirmed permission/API-permission manifest synchronization placeholder for the in-memory foundation; it invalidates cached permission contexts and returns the confirmed manifests without claiming DB-backed persistence.
- Added `POST /api/roles/:id/enable` and `POST /api/roles/:id/disable` for explicit role status management guarded by `role:status:update`, with permission-cache invalidation and route coverage.
- Tightened generic role updates so role status changes must use the explicit role status endpoints instead of the `role:update` endpoint.
- Tightened Super Administrator organization handling so an active built-in `super_admin` role binding can list all enabled organizations, switch to enabled organizations without a separate user-organization-role binding, and receive all enabled base permissions across selectable organization contexts. Ordinary users remain scoped to their enabled bound organizations and current organization role.
- Tightened refresh-token exchange so disabled or locked accounts cannot receive new access tokens from an otherwise valid refresh token.
- Tightened refresh-token exchange so sessions whose current organization has been disabled cannot receive new access tokens.
- Added route coverage proving login falls back to another enabled organization when the user's primary organization is disabled, and denies login when no enabled organization is available.
- Tightened logout so the ordinary logout endpoint revokes the current authenticated session and rejects attempts to revoke a different session id.
- Aligned the login response with the documented authentication contract by returning the current organization, selectable organizations, effective permission codes, filtered menus, and password-change requirement flag alongside the access token, session, and user summary.
- Tightened logout cookie handling so successful logout revokes the stored refresh token/session and also clears the HttpOnly refresh-token cookie used by the browser refresh flow.
- Tightened session activity tracking so successful bearer-token authentication updates the session `lastSeenAt` value used by the online-user data source.
- Tightened failed-login state tracking so failed password attempts update the user's failed-attempt counter, timed lock fields, and `updatedAt` audit timestamp together.
- Tightened repeated seed synchronization so existing built-in roles are restored to enabled built-in metadata while preserving idempotent role and permission creation.
- Tightened core entity path-ID validation so user, organization, role, menu, and nested user-organization route IDs must be integer strings before resource lookup, matching the API ID input contract.
- Tightened organization re-enable behavior so a descendant cannot be re-enabled while any ancestor remains disabled; administrators must re-enable the parent path first and descendants remain separate explicit actions.
- Tightened role permission updates so duplicate permission codes in an update request are normalized before writing role-permission records, matching the unique role/permission relationship.
- Tightened user soft deletion so deleting a user advances token version, invalidates that user's permission cache, and causes old access/refresh tokens to fail with `AUTH_TOKEN_INVALIDATED`.
- Tightened user status changes so disable, enable, lock, and unlock operations invalidate that user's permission cache after the account state change.
- Tightened organization mutations so create, update, disable, enable, and soft delete operations clear cached permission contexts through the permission-cache boundary.
- Tightened administrator password reset so reset operations clear the user's permission cache and route coverage proves old access tokens, refresh tokens, and online-session visibility are invalidated through the user token version.
- Tightened login cookie handling so the HttpOnly refresh-token cookie `Max-Age` is derived from the configured refresh-token TTL instead of a fixed value.
- Tightened current-user password changes so successful changes clear the user's permission cache and route coverage proves stale sessions are removed from the online-user data source through token-version checks.
- Tightened failed-login lock expiration so expired timed locks clear status, lock timestamp, and stale failure count before new credential checks, while administrator locks remain manual.
- Tightened online-user session bookkeeping so active sessions whose expiration has passed are marked `expired` when the online-user data source is queried.
- Tightened administrator user updates so successful profile or primary-organization changes clear the user's permission cache, and route coverage proves the updated primary organization drives the next login context.
- Tightened per-user permission cache invalidation so super-administrator contexts cached in organizations without direct user-role bindings are cleared when that user's effective permissions change.
- Tightened the online-user data source so sessions whose current organization becomes disabled or deleted are no longer listed as online.
- Tightened account lock transitions so administrator locks and configured failed-login locks advance user token version, keeping pre-lock access and refresh tokens invalid after unlock or timed lock expiry.
- Tightened user-organization-role binding audit updates so primary-organization changes and binding removals retain the authenticated administrator actor in the binding lifecycle fields.
- Tightened managed menu tree validation so administrators cannot reparent a menu under one of its descendants and create a cycle in the permission-controlled menu tree.
- Tightened role permission updates so changing a role's permission set records the authenticated administrator actor on the role audit fields.
- Tightened current-user password changes so the authenticated user is recorded in the user audit fields when password lifecycle state changes.
- Tightened global permission-cache invalidation so manifest, route, menu, and organization changes clear cached super-administrator contexts in organizations where the user has no direct role binding.
- Tightened RBAC permission resolution so ordinary role grants only include permissions whose metadata records are currently enabled, matching the existing super-administrator permission filtering.

This is not yet the complete backend core foundation. DB-backed repositories, executable migrations, PostgreSQL integration tests, durable initialization/auth/session persistence, durable seed execution, and finalized CSRF protection still depend on the unresolved implementation questions.

## Recommended Next Goals

1. Confirm the concrete SQLite driver and PostgreSQL test provisioning approach.
2. Wire real SQLite and PostgreSQL Drizzle connections plus executable migrations.
3. Implement DB-backed repositories for initialization, auth/session, users, organizations, roles, permissions, menus, and route/API permission metadata.
4. Wire the existing initialization setup and seed CLI paths to the DB-backed repositories.
5. Implement auth/session endpoints and core CRUD routes with PostgreSQL integration tests.
