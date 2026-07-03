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
- Tightened SQLite/PostgreSQL Drizzle schema metadata so backend core enum and lifecycle status checks are represented in schema definitions as well as the hand-written migrations.
- Tightened SQLite/PostgreSQL Drizzle schema metadata so organization path-level and active-session lookup indexes are represented in schema definitions as well as the hand-written migrations.
- Aligned permission and API-permission Drizzle schemas/migrations with the manifest-backed metadata records, including module, required permission, and public/private API metadata.
- Added organization materialized path helpers for the confirmed int64 design: `encodeOrgPath`, `decodeOrgPath`, `getOrgPathRange`, `isDescendantPath`, and sibling segment allocation.
- Tightened organization segment allocation so exhausted root/child sibling ranges translate to a stable business error instead of an internal error.
- Tightened SQLite/PostgreSQL organization schema constraints so root organization segments are restricted to 1-127 at the database layer, matching the confirmed materialized-path design.
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
- Added stable backend API error handling for known authentication, validation, business, and system errors. Zod request failures and malformed JSON request bodies now return `VALIDATION_INVALID_REQUEST`, and business/auth failures return their stable error codes instead of leaking raw internal errors.
- Added a base API permission metadata manifest for the implemented backend-core routes. It declares method, path, API permission code, module, log level, public/private status, and required permission where applicable. The existing `/api/permissions/manifest` endpoint now exposes this API metadata alongside the permission manifest so a later DB-backed permission sync can persist it to `api_permissions`.
- Added contract coverage ensuring API permission metadata only references declared base permission codes.
- Added manifest-driven API authorization middleware for the implemented backend-core Hono routes. Public routes remain callable without a token; private routes require a Bearer access token and, where declared by the API permission metadata, the user's current-organization role must grant the required permission.
- Tightened API authorization middleware so bearer tokens are parsed only for known private API manifest entries; unknown routes now return the stable not-found response even when a stale bearer header is present.
- Added API manifest route coverage so every registered Hono API route must have matching API permission metadata, preventing unguarded private routes from being introduced silently.
- Added API manifest contract coverage so private routes without an RBAC `requiredPermission` must stay limited to authenticated self-context and password/session lifecycle endpoints.
- Added in-memory permission and API-permission metadata records seeded during initialization and refreshed idempotently by `POST /api/permissions/sync`; `/api/permissions` now returns initialized permission records with API JSON string IDs while `/api/permissions/manifest` remains the generated manifest preview.
- Aligned permission records with confirmed manifest metadata by recording `source` and deterministic `manifest_hash` values for base manifest permissions in the in-memory model and SQLite/PostgreSQL schemas/migrations.
- Aligned permission records with confirmed `resource` and `action` metadata by deriving those fields from base permission codes such as `user:view` during manifest sync and persisting the same columns in SQLite/PostgreSQL schemas/migrations.
- Wired the permission cache into authorization checks and invalidates cached user/organization permission contexts when role permissions or user-organization-role bindings change.
- Added the current-user `/api/auth/change-password` backend flow. New admin-created users and administrator password resets require password change before ordinary private APIs; password changes validate the old password, enforce the configured password policy, clear the forced-change flag, advance password expiration, and increment token version so old access tokens are invalidated.
- Moved password policy into backend core configuration while preserving the confirmed default minimum 8 characters, letters plus numbers, and 365-day periodic password change cycle.
- Added session-bound access token claims and `/api/context/current-organization` switching. Switching verifies the user-organization binding, rejects disabled organizations, updates the active session's current organization, returns a replacement access token, and returns refreshed permission/menu context for the selected organization. Revoked sessions and stale organization tokens are now rejected during access-token authentication.
- Added `/api/auth/me` for current user context. It returns the public user profile, active session, current organization, enabled selectable organizations, current permission codes, filtered menus, and password-change requirement status, and remains available while a forced password change is pending.
- Added PRD-compatible aliases for existing context behavior: `POST /api/auth/current-organization` switches the current organization and `GET /api/permissions/effective` returns the current effective permission context.
- Added PRD-compatible initialization aliases: `GET /api/setup/status` and `POST /api/setup/initialize` delegate to the same first-start initialization status/setup flow as the design-spec `/api/initialization/*` endpoints.
- Added `GET /api/context/organizations` for the current user's enabled organization selector context, with API permission metadata and route coverage.
- Added a concrete in-memory `TokenStoreAdapter` and wired refresh-token store, lookup, and session revocation through the token-store boundary. The existing in-memory refresh-token records remain the current backing-table representation until DB-backed repositories are unblocked.
- Added token-store adapter coverage for copy isolation, single-token revocation, and session-level revocation so future durable token-store implementations preserve the refresh-token invalidation contract.
- Added login-session token-version snapshots to the in-memory auth session model, SQLite/PostgreSQL Drizzle schemas, and SQL migrations. Access-token validation, refresh-token exchange, and online-user listing now reject stale sessions whose snapshot no longer matches the user's current token version.
- Added login-session status tracking (`active`, `revoked`, `expired`) to the in-memory auth session model, SQLite/PostgreSQL Drizzle schemas, and SQL migrations. Login creates active sessions, logout marks sessions revoked, expiry checks can mark sessions expired, and online-user listing only returns active sessions.
- Tightened user disablement so disabling an account increments the user token version. Old access and refresh tokens remain invalid after the account is later re-enabled.
- Tightened account lock behavior so administrator locks without an expiration deny login until administrator unlock, while configured failed-login locks still use `lockedUntil` for timed release. Unlocking clears failed-login counters and lock expiration.
- Tightened user update validation so administrator edits preserve unique username, email, and phone values and cannot set a disabled organization as the user's primary organization.
- Added route coverage for the historical disabled-organization write rule: disabled organizations reject new users and new user-organization-role bindings while existing historical records remain queryable.
- Added route coverage proving disabled organizations also reject new child organization creation under the disabled parent path.
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
- Added route coverage proving soft-deleted assigned roles lose API grants after role deletion and cache invalidation.
- Tightened role copy code generation to allocate deterministic next-available copy codes instead of timestamp-derived codes.
- Added route coverage proving role copy creates a new role and preserves the copied permission configuration.
- Added `GET /api/roles/:id/permissions` to read a role's configured permission codes, with API permission metadata and route coverage.
- Added `GET /api/users/:id/organizations` to read a user's organization-role bindings, with API permission metadata and route coverage.
- Added PRD-compatible API permission identifier endpoints `GET /api/permissions/api` and `POST /api/permissions/api/sync` over the existing manifest-backed API permission metadata service, guarded by API permission metadata and route coverage.
- Added managed menu records seeded during initialization, moved `/api/menus/tree` to the backend core service, and added `POST /api/menus`, `PATCH /api/menus/:id`, and `DELETE /api/menus/:id` with API permission metadata and route coverage.
- Added `PUT /api/menus/:id/api-bindings` over the existing menu/API permission binding model, with enabled API-permission validation, duplicate ID normalization, permission-cache invalidation, and route coverage.
- Tightened managed menu soft deletion so menu/API permission bindings are removed when a menu or its descendants are soft deleted.
- Aligned managed menus with the confirmed `visible` field in contracts, in-memory records, SQLite/PostgreSQL schemas/migrations, and permission-context filtering. Hidden menus remain manageable but are omitted from returned menu context.
- Tightened organization, user, and role detail endpoints so missing records return stable `ORGANIZATION_NOT_FOUND`, `USER_NOT_FOUND`, and `ROLE_NOT_FOUND` errors instead of empty successful responses.
- Added `GET /api/context/permissions` for the current RBAC/menu permission context and clears cached permission contexts when managed menus change.
- Added route metadata records seeded during initialization, moved `/api/routes/manifest` to the backend core service, and added `POST /api/routes/sync` as the admin-confirmed route manifest synchronization placeholder with API permission metadata and route coverage.
- Aligned route metadata records with the confirmed route manifest metadata fields by recording `metadata_json` and deterministic `manifest_hash` values in the in-memory model and SQLite/PostgreSQL schemas/migrations.
- Added `POST /api/permissions/sync` as the admin-confirmed permission/API-permission manifest synchronization placeholder for the in-memory foundation; it invalidates cached permission contexts and returns the confirmed manifests without claiming DB-backed persistence.
- Added `POST /api/roles/:id/enable` and `POST /api/roles/:id/disable` for explicit role status management guarded by `role:status:update`, with permission-cache invalidation and route coverage.
- Tightened generic role updates so role status changes must use the explicit role status endpoints instead of the `role:update` endpoint, and strict role update validation now rejects stray `status` payloads instead of silently ignoring them.
- Tightened Super Administrator organization handling so an active built-in `super_admin` role binding can list all enabled organizations, switch to enabled organizations without a separate user-organization-role binding, and receive all enabled base permissions across selectable organization contexts. Ordinary users remain scoped to their enabled bound organizations and current organization role.
- Tightened refresh-token exchange so disabled or locked accounts cannot receive new access tokens from an otherwise valid refresh token.
- Tightened refresh-token exchange so sessions whose current organization has been disabled cannot receive new access tokens.
- Tightened refresh-token exchange so sessions whose current organization has been soft deleted are rejected with the same unusable-organization business error as disabled organizations.
- Tightened public API authorization handling so cookie-backed refresh-token exchange does not require or parse a bearer access token before using the refresh token.
- Tightened refresh-token cookie parsing so malformed cookie encoding returns the stable `AUTH_TOKEN_EXPIRED` error instead of leaking an internal decode error.
- Added route coverage proving login falls back to another enabled organization when the user's primary organization is disabled, and denies login when no enabled organization is available.
- Added route coverage proving login also falls back to another enabled organization when the user's primary organization has been soft deleted.
- Tightened logout so the ordinary logout endpoint revokes the current authenticated session and rejects attempts to revoke a different session id.
- Aligned the login response with the documented authentication contract by returning the current organization, selectable organizations, effective permission codes, filtered menus, and password-change requirement flag alongside the access token, session, and user summary.
- Tightened logout cookie handling so successful logout revokes the stored refresh token/session and also clears the HttpOnly refresh-token cookie used by the browser refresh flow.
- Tightened session activity tracking so successful bearer-token authentication updates the session `lastSeenAt` value used by the online-user data source.
- Tightened failed-login state tracking so failed password attempts update the user's failed-attempt counter, timed lock fields, and `updatedAt` audit timestamp together.
- Tightened repeated seed synchronization so existing built-in roles are restored to enabled built-in metadata while preserving idempotent role and permission creation.
- Tightened repeated seed synchronization so soft-deleted built-in roles are restored in place instead of creating replacement role records with duplicate historical codes.
- Tightened repeated seed synchronization so soft-deleted base menus are restored in place with manifest metadata instead of creating replacement menu records.
- Tightened repeated seed synchronization so restored manifest permissions, API permission metadata, base menus, and route metadata clear stale cached permission contexts before users read permissions again.
- Tightened core entity path-ID validation so user, organization, role, menu, and nested user-organization route IDs must be integer strings before resource lookup, matching the API ID input contract.
- Broadened route coverage for core entity path-ID validation across organization, user, role, menu, and nested user-organization endpoints.
- Tightened logout request validation so the optional session ID body field uses the shared integer-string API ID contract before session authorization checks.
- Tightened organization re-enable behavior so a descendant cannot be re-enabled while any ancestor remains disabled; administrators must re-enable the parent path first and descendants remain separate explicit actions.
- Tightened role permission updates so duplicate permission codes in an update request are normalized before writing role-permission records, matching the unique role/permission relationship.
- Tightened role permission update coverage so unknown permission codes return the stable `PERMISSION_UNKNOWN_CODE` error and leave the previous role grants unchanged.
- Tightened user soft deletion so deleting a user advances token version, invalidates that user's permission cache, and causes old access/refresh tokens to fail with `AUTH_TOKEN_INVALIDATED`.
- Added route coverage proving a soft-deleted user cannot start a new username/password login session.
- Tightened user status changes so disable, enable, lock, and unlock operations invalidate that user's permission cache after the account state change.
- Tightened organization mutations so create, update, disable, enable, and soft delete operations clear cached permission contexts through the permission-cache boundary.
- Tightened administrator password reset so reset operations clear the user's permission cache and route coverage proves old access tokens, refresh tokens, and online-session visibility are invalidated through the user token version.
- Added route coverage proving administrator password reset enforces the configured password policy and leaves user lifecycle state unchanged when the reset password is rejected.
- Tightened generic user updates so status changes and password changes must use their explicit endpoints; strict user update validation now rejects stray `status` and `password` payloads instead of silently ignoring them.
- Tightened login cookie handling so the HttpOnly refresh-token cookie `Max-Age` is derived from the configured refresh-token TTL instead of a fixed value.
- Tightened current-user password changes so successful changes clear the user's permission cache and route coverage proves stale sessions are removed from the online-user data source through token-version checks.
- Tightened failed-login lock expiration so expired timed locks clear status, lock timestamp, and stale failure count before new credential checks, while administrator locks remain manual.
- Tightened online-user session bookkeeping so active sessions whose expiration has passed are marked `expired` when the online-user data source is queried.
- Tightened administrator user updates so successful profile or primary-organization changes clear the user's permission cache, and route coverage proves the updated primary organization drives the next login context.
- Tightened per-user permission cache invalidation so super-administrator contexts cached in organizations without direct user-role bindings are cleared when that user's effective permissions change.
- Tightened the online-user data source so sessions whose current organization becomes disabled or deleted are no longer listed as online.
- Added route coverage proving sessions whose current organization is soft deleted are excluded from the online-user data source while other active sessions remain listed.
- Tightened account lock transitions so administrator locks and configured failed-login locks advance user token version, keeping pre-lock access and refresh tokens invalid after unlock or timed lock expiry.
- Tightened user-organization-role binding audit updates so primary-organization changes and binding removals retain the authenticated administrator actor in the binding lifecycle fields.
- Tightened managed menu tree validation so administrators cannot reparent a menu under one of its descendants and create a cycle in the permission-controlled menu tree.
- Tightened role permission updates so changing a role's permission set records the authenticated administrator actor on the role audit fields.
- Tightened current-user password changes so the authenticated user is recorded in the user audit fields when password lifecycle state changes.
- Tightened global permission-cache invalidation so manifest, route, menu, and organization changes clear cached super-administrator contexts in organizations where the user has no direct role binding.
- Tightened RBAC permission resolution so ordinary role grants only include permissions whose metadata records are currently enabled, matching the existing super-administrator permission filtering.
- Tightened session API serialization so refresh-token hashes remain internal and are not returned by login, refresh, logout, current-user context, or online-user responses.
- Added contract coverage for base route and menu manifest consistency so seeded menus cannot reference undeclared route codes, parent menu codes, or permission codes.
- Aligned `/api/organizations/tree` and `/api/menus/tree` with their management contracts by returning nested `children` trees. Organization nesting is derived from the confirmed materialized-path design without adding `parent_id`, and menu nesting uses the existing managed menu parent relationship.
- Tightened managed menu validation so administrator-created or updated menus cannot reference unknown permission codes or undeclared route metadata records. Initialization now syncs base route metadata before seeding base menus so seed data follows the same validation path as API-created menus.
- Aligned in-memory uniqueness rules with the current SQLite/PostgreSQL non-partial unique indexes so soft-deleted users, organizations, roles, and menus keep their unique identifiers reserved for audit-safe historical references.
- Tightened managed menu soft deletion so deleting a parent menu also soft deletes descendant menus, preventing orphaned children from appearing as root entries in `/api/menus/tree`.
- Aligned organization segment allocation with the current non-partial `organizations.path` unique index so soft-deleted organization paths remain reserved and replacement siblings receive a new materialized-path segment.
- Tightened organization soft deletion so deleting a parent organization also soft deletes descendants through the materialized-path relationship, preventing orphaned child organizations from appearing as root entries in `/api/organizations/tree`.
- Tightened organization disable cascade responses so already soft-deleted organizations remain excluded, matching the default repository rule that soft-deleted records are hidden from normal queries.
- Tightened role permission updates so grant requests are validated against the current synced permission metadata records, not only the static manifest, and stale/missing permission metadata leaves existing grants unchanged.
- Tightened user soft deletion so the user's organization-role bindings are also soft deleted, disabled, marked non-primary, and audited with the same deleting actor while preserving historical binding records.
- Tightened organization soft deletion so user-organization-role bindings under the deleted organization subtree are soft deleted, disabled, marked non-primary, and audited while bindings outside the deleted subtree remain active.
- Tightened role soft deletion so user-organization-role bindings that reference the deleted role are soft deleted, disabled, marked non-primary, and audited; login now requires an active organization binding before selecting the user's primary organization unless the user still has an active super-administrator binding.
- Tightened role soft deletion so role-permission grants are removed when the role is deleted, matching the non-soft-delete role-permission backing table lifecycle.
- Tightened repeated seed synchronization so the initialized administrator's active super-administrator binding is restored after built-in role recovery, keeping seed reruns idempotent after role lifecycle changes.
- Tightened session authorization so access-token validation, refresh-token exchange, and online-user listing require the session's current organization to remain reachable through an active user-organization-role binding or an active super-administrator binding.
- Tightened organization access resolution so user-organization-role bindings only count as usable when the binding is enabled and the referenced role is still enabled and not soft deleted.
- Tightened primary-organization updates so administrators cannot select a user's organization binding as primary when the binding's assigned role has been disabled or soft deleted.
- Aligned refresh-token cookie configuration with the design-spec `AUTH_REFRESH_COOKIE_PATH` setting; login and logout now set or clear the HttpOnly refresh cookie on the configured path, defaulting to `/api/auth/refresh`.
- Tightened managed menu soft deletion so deleted menu records and descendants are marked disabled while retaining `is_deleted`, `deleted_at`, and `deleted_by` audit fields.
- Tightened permission manifest synchronization so stale base permission/API metadata is disabled, and role permission updates only accept currently enabled permission metadata.
- Tightened API permission manifest synchronization so legacy metadata records are reconciled by method/path when the canonical API permission code record is missing, matching the database unique constraints.
- Tightened permission manifest synchronization so menu/API permission bindings pointing at disabled or missing API permission metadata are pruned.
- Tightened stale role-permission lifecycle so disabled or missing permission metadata is pruned during manifest sync and excluded from role permission reads/copies.
- Tightened repeated seed synchronization so base menus are reconciled by path when the canonical menu code record is missing, matching the menu path uniqueness rule.
- Tightened managed menu validation so menu bindings can only reference currently enabled permission metadata.
- Tightened route metadata lifecycle so route manifest sync disables stale route records, and managed menus can only reference enabled route metadata.
- Tightened effective menu context filtering so menus linked to disabled or stale route metadata are hidden from user navigation after route manifest sync.
- Tightened repeated seed synchronization so permission manifests use the same stale role-permission pruning lifecycle as admin-confirmed permission sync.
- Tightened repeated seed synchronization so existing super-administrator permission grants are repaired back to allow-effect records.
- Tightened repeated seed synchronization so duplicate super-administrator permission grants are collapsed back to one allow record per permission.
- Tightened role copy so duplicate source role-permission rows are normalized to one copied grant per permission code.
- Tightened role permission reads so duplicate backing role-permission rows are exposed as one effective permission code while preserving first-seen order and enabled-permission filtering.
- Tightened effective RBAC permission resolution so ordinary user permission contexts also collapse duplicate backing role-permission rows to one permission code.
- Tightened user-organization-role assignment so reassignment repairs duplicate active bindings and preserves the one-role-per-user-organization invariant.
- Tightened user-organization-role removal so deleting an organization assignment soft-deletes all duplicate non-primary bindings for that user and organization.
- Added route coverage proving primary organization role reassignment preserves the primary binding marker while repairing duplicate active bindings.
- Added paged-list responses for the implemented user and role list endpoints. `page` and `pageSize` default to `1` and `20`, and explicit pagination queries return the same envelope shape for future DB-backed repository alignment.
- Added documented user-list filters for keyword, account status, and active organization binding, with route coverage over the paged query response.
- Added role-list filters over documented role fields: keyword matching name/code/description and status matching enabled/disabled roles, with route coverage over the paged query response.
- Added API-permission identifier filters over manifest-backed metadata: keyword matching code/path/description/required permission plus method, module, status, and public/private flags.
- Tightened API-permission identifier filter validation so unsupported HTTP methods and malformed public/private boolean values return the stable validation error.
- Added route coverage proving invalid user/role list status filters and pagination values return `VALIDATION_INVALID_REQUEST`.
- Added route coverage proving refresh-token exchange advances the backing session `lastSeenAt` timestamp, keeping the online-user data source aligned with refresh activity.
- Tightened the online-user listing route so it asserts an authenticated context locally in addition to API-manifest authorization, with route coverage proving users without `online-user:view` cannot read the session-backed online-user source.
- Tightened command-line seed summary coverage so route metadata and API-permission metadata creation are asserted alongside roles, permissions, menus, organization, and administrator output.
- Tightened repeated seed synchronization so a soft-deleted initialization owner is not returned as the active administrator in seed results, preserving the default soft-delete response rule without inventing replacement-admin behavior.
- Tightened organization manager references so create/update requests can only set `managerUserId` to an existing non-deleted user, preventing broken organization-user references before DB-backed foreign keys are available.
- Added service coverage proving expired refresh-token exchange marks the backing login session `expired` and keeps it excluded from the online-user data source.
- Aligned the SQLite/PostgreSQL menu schema and migrations with the documented menu permission-code model by storing menu permission references as `permission_code` instead of `permission_id`.
- Added route coverage proving first-start initialization rejects a weak super-administrator password under the configured password policy and leaves the system uninitialized.
- Added seed-command coverage proving CLI initialization enforces the same configured super-administrator password policy as the first-start wizard path.
- Added route coverage proving configured failed-login account locks invalidate existing access/refresh sessions and remove the user from the online-session data source.
- Tightened access-token verification so signed JWTs with missing or malformed required auth/session claims are rejected before entering backend auth context logic.
- Added API-permission identifier filtering by confirmed `log_level` metadata, including validation for unsupported log-level query values.
- Added initialized permission-record filtering by confirmed flat metadata fields: keyword, module, resource, action, type, source, and status.
- Added optional paged envelopes for permission and API-permission list endpoints when `page` or `pageSize` query parameters are provided, while preserving existing array responses without pagination parameters.
- Added route metadata manifest filtering by confirmed manifest fields plus optional paged envelopes for `/api/routes/manifest`.
- Added online-user session filtering by user and organization plus optional paged envelopes for `/api/online-users`, while preserving the existing array response without pagination parameters.
- Tightened organization update contracts so v1 organization move attempts using `parentOrganizationId` are rejected instead of silently ignored, preserving the confirmed no-move materialized-path rule.
- Tightened backend-core mutation contracts so unknown JSON fields are rejected instead of silently stripped, preventing unconfirmed lifecycle, hierarchy, and permission-reference fields from being accepted on implemented create/update/action endpoints.
- Tightened no-body lifecycle and manifest-sync action routes so unexpected JSON payload fields are rejected instead of ignored, while still allowing absent or empty-object bodies on routes whose target is fully defined by path/auth context.
- Tightened session API serialization so the internal session token-version snapshot remains hidden from login, refresh, logout, current-user context, and online-user responses while still being used for invalidation checks.
- Tightened the cookie-backed refresh-token endpoint so JSON request bodies are rejected; refresh exchange uses the HttpOnly refresh-token cookie plus the confirmed double-submit CSRF token boundary.
- Added confirmed refresh-token cookie configuration for SameSite, Secure, Domain, and Path; login and logout now use the same configured cookie attributes, and `.env.example` exposes the deployment knobs.
- Added the reserved public `GET /api/metrics` observability placeholder with request ID propagation and API permission manifest coverage.
- Tightened refresh-token exchange so the backing login session expiry is enforced even if the token-store record still appears valid, and expired sessions are marked `expired`.
- Aligned the serialized JWT access-token payload with the confirmed `token_version` claim while keeping the internal TypeScript auth context camelCase.
- Added route coverage proving login responses do not serialize the raw refresh token; the token is delivered only through the configured HttpOnly cookie boundary.
- Added route coverage proving refresh responses do not serialize the raw refresh token or internal session token-version snapshot.
- Added route coverage proving current-user and logout session responses also hide the internal session token-version snapshot.
- Added route coverage proving public auth and user-management responses do not serialize raw passwords or password hashes.

This is not yet the complete backend core foundation. DB-backed persistence now exists for the implemented backend-core store behind `BACKEND_CORE_STORE=database`, and PostgreSQL integration coverage exercises the persisted initialization/auth/session path. Role data permissions, role field permissions, and user permission overrides currently have persistence tables only; service-level APIs and effective-permission behavior remain future work.

## Recommended Next Goals

1. Implement service-level APIs and effective permission evaluation for role data permissions, role field permissions, and user permission overrides.
2. Add explicit local documentation for running API and seed with `BACKEND_CORE_STORE=database`.
3. Continue into backend infrastructure modules only after the backend-core permission-extension slice is stable.

## Frontend Admin UI Progress

The frontend admin UI foundation has been implemented in `apps/web`:

- Added a desktop-first admin shell with classic left sidebar, top bar, breadcrumb, persistent page tabs, organization selector, logout flow, fullscreen toggle, dark mode, and theme color controls.
- Added authentication UI for username/password login, forced password change, ordinary password change, and logout state clearing.
- Added Zustand-backed auth, current organization, layout, tab, language, dark-mode, and theme-color state.
- Added TanStack Query-backed page data loading through a typed API boundary that references the Hono RPC contract placeholder. Existing backend-core pages are marked as available API boundaries; pages whose backend modules are not implemented yet use typed placeholder data.
- Added route metadata for the required base management pages separately from route registration.
- Added permission-aware menu visibility, page guard behavior, action-button filtering, and field hiding based on returned field metadata.
- Added English and Chinese UI message dictionaries with personal-settings language override.
- Added reusable management-page patterns for search/filter, table, action area, loading, empty, error, permission-denied, and integration-pending states.
- Added base pages for users, organizations, roles, permissions, menus, system configuration, dictionaries, files, announcements, in-app notifications, online users, all required log pages, task scheduler, import/export tasks, personal center, password change, and personal settings.
- Added Vitest + React Testing Library coverage for login rendering, the authenticated shell, organization selector, and personal settings controls.

The infrastructure-management pages intentionally do not claim durable backend integration yet because the backend infrastructure goal is paused on the unresolved implementation questions in `docs/implementation_questions.md`.

## Integration Hardening Progress

The integration hardening goal has added the following coherent, tested pieces:

- Added `createOpenApiDocument()` in `packages/contracts`, generated from the implemented API permission manifest and aligned with the existing Zod-backed request contracts.
- Added public `GET /api/openapi.json` API documentation for implemented APIs only.
- Added API permission metadata for the OpenAPI document endpoint so the route remains covered by manifest consistency checks.
- Added build-time manifest artifact generation through `packages/contracts` with `pnpm generate:manifests`, producing `packages/contracts/generated/base-system-manifests.json`.
- Added OpenAPI contract tests proving every implemented API permission manifest entry is documented and private routes carry bearer-security metadata.
- Added structured access-log middleware with a no-op default sink and request ID propagation into log entries.
- Added an alert integration placeholder boundary for future production alert integrations.
- Added error-code catalog coverage for authentication, authorization, validation, business, system, and third-party categories.
- Added documentation: `README.md`, local development guide, deployment guide, database migration guide, adapter extension guide, business module extension guide, permission extension guide, troubleshooting guide, and `docs/known_gaps.md`.

The following validation gates are expected to pass after this hardening slice:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

`pnpm db:migrate` now runs SQLite migrations through `better-sqlite3` and runs PostgreSQL migrations when `TEST_DATABASE_URL` or `DATABASE_URL` is provided.

## Database Execution Progress

The database execution slice completed the following:

- Confirmed `better-sqlite3` as the v1 SQLite local/demo driver and `TEST_DATABASE_URL` as the PostgreSQL integration-test database source.
- Added real SQLite and PostgreSQL Drizzle connection factories in `packages/db`.
- Added executable migration runners for SQLite and PostgreSQL using the existing dialect-specific SQL migration files.
- Added SQLite migration smoke tests, including bigint-safe organization materialized-path reads at the driver boundary.
- Added PostgreSQL migration smoke tests that run only when `TEST_DATABASE_URL` is present.

## Backend Core Persistence Resume

The resumed backend-core persistence slice completed the following:

- Added DB-backed backend-core services behind `BACKEND_CORE_STORE=database` while preserving the existing in-memory default for focused unit tests.
- Added a relational store repository for initialization state, auth sessions, refresh tokens, users, organizations, roles, role permissions, permissions, menus, menu/API bindings, route metadata, API permission metadata, and user-organization-role bindings.
- Wired API runtime and the seed CLI to use DB-backed services when `BACKEND_CORE_STORE=database` is set.
- Added PostgreSQL integration coverage using `TEST_DATABASE_URL` for initialization, reload, auth session/token persistence, users, permissions, route/menu metadata, virtual permission tree, and refresh-token exchange after reload.
- Implemented the confirmed double-submit CSRF protection for refresh/logout cookie endpoints with `csrf_token` and `x-csrf-token`.
- Added `GET /api/permissions/tree` as a virtual tree derived from flat permission metadata without adding permission `parent_id`.
- Added SQLite/PostgreSQL migrations and Drizzle schema for `role_data_permissions`, `field_permission_rules`, and `user_permission_overrides` according to the confirmed persistence decisions.

The next recommended backend-core goal is to add service-level APIs and effective permission evaluation for role data permissions, role field permissions, and user permission overrides.

## Backend Core Aggregate Persistence

The backend-core persistence refactor completed the following:

- Added focused aggregate repositories for initialization state, auth sessions/refresh tokens, users, organizations, roles/role permissions, permission/API metadata, menus/menu API bindings, route metadata, and user-organization-role bindings.
- Changed DB-backed runtime mutation paths to persist only the affected aggregate scopes instead of clearing and rewriting all backend-core tables after every mutation.
- Kept the whole-store snapshot save path only for test reset and full-store support utilities; normal API mutation flows now use aggregate repositories.
- Preserved `BACKEND_CORE_STORE=database` runtime and seed support.
- Expanded PostgreSQL integration coverage for first-start initialization, DB-backed seed idempotency, login/refresh/logout, user mutations, organization mutations, role/role-permission mutations, user-organization-role assignment/removal, menu/API binding mutations, permission sync, and route sync.

The next recommended backend-core goal is to implement service-level APIs and effective permission evaluation for role data permissions, role field permissions, and user permission overrides.

## Backend Core Permission Extension Services

The backend-core permission extension slice completed the following:

- Added contract schemas for role data-permission updates, role field-permission updates, and user permission override updates.
- Added service-level APIs and Hono endpoints for:
  - `GET /api/roles/:id/data-permissions`
  - `PUT /api/roles/:id/data-permissions`
  - `GET /api/roles/:id/field-permissions`
  - `PUT /api/roles/:id/field-permissions`
  - `GET /api/permissions/user-overrides/:userId`
  - `PUT /api/permissions/user-overrides/:userId`
- Added API permission manifest metadata for the new endpoints using existing base permissions.
- Added in-memory store support for `role_data_permissions`, `field_permission_rules`, and `user_permission_overrides`.
- Added DB load/save support and a focused permission-extension aggregate repository for the same records.
- Extended effective permission context calculation so role permissions remain the base grant set and user overrides apply afterward; `deny` removes a role grant and `allow` adds a permission.
- Extended current/effective permission responses with active data permission rules, field permission rules, and user override effects.
- Invalidated permission cache contexts after role data-permission changes, role field-permission changes, and user permission override changes.
- Fixed DB-backed async user creation persistence so user and initial organization-role bindings are saved after password hashing completes.
- Added in-memory route coverage and PostgreSQL reload coverage for permission extension records, effective permission behavior, and cache invalidation.

The next recommended backend-core goal is to tighten OpenAPI request/response schemas for the newly implemented permission-extension endpoints and then move to infrastructure work only after the remaining infrastructure questions are resolved.

## Permission Extension Contract Hardening

The permission-extension contract hardening slice completed the following:

- Added OpenAPI request schema mappings for role data-permission updates, role field-permission updates, and user permission override updates.
- Added OpenAPI response schema mappings for role data permissions, role field permissions, user permission overrides, and the effective permission context.
- Documented the effective permission context response fields for `dataPermissions`, `fieldPermissions`, and `userPermissionOverrides`.
- Added manifest consistency tests for the new permission-extension API metadata.
- Added OpenAPI tests for the new permission-extension request and response schemas.
- Changed API route composition so the newly implemented permission-extension routes retain Hono route schema types.
- Added a Hono RPC type test proving typed client access remains available for the new permission-extension routes.

The next recommended backend-core goal is to add full response-schema coverage for the older backend-core endpoints, or move to infrastructure modules after resolving the infrastructure questions in `docs/implementation_questions.md`.

## Infrastructure Foundation Progress

The remaining-gap implementation pass confirmed the previously blocked infrastructure decisions and added the first durable infrastructure foundation:

- Resolved infrastructure questions 10-20 in `docs/implementation_questions.md` using the recommended v1 decisions.
- Added SQLite/PostgreSQL migrations and Drizzle schema tables for:
  - `cache_entries`
  - `rate_limit_counters`
  - `locks`
  - `queue_jobs`
  - `event_outbox`
  - `scheduled_jobs`
  - `file_objects`
  - `notifications`
  - `notification_templates`
  - `log_entries`
  - `import_export_tasks`
- Added schema and migration tests proving the new infrastructure tables are present in SQLite and PostgreSQL migration execution.
- Added runnable in-memory default adapters for lock, queue, event bus, rate limit, scheduler, and notifications.
- Added a local filesystem storage adapter that writes through a temp file and then atomically renames into place, supporting shared mounted local storage compatibility.
- Extended the worker runtime with queue task and scheduled task registration boundaries while keeping the default worker safe to run with no configured tasks.

The next recommended goal is to implement database-backed adapter drivers and backend API modules over these infrastructure tables, then replace frontend placeholders page by page as those APIs become available.
