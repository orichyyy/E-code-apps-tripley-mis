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

## Infrastructure Durable Adapter and API Progress

The infrastructure gap slice completed the following tested pieces:

- Added database-backed adapter drivers over the existing durable infrastructure tables:
  - `CacheAdapter` over `cache_entries`
  - `RateLimitAdapter` over `rate_limit_counters`
  - `LockAdapter` over `locks` using the confirmed lease-table strategy
  - `QueueAdapter` over `queue_jobs` with durable claim/complete/fail processing
  - `EventBusAdapter` over `event_outbox`
  - `JobSchedulerAdapter` over `scheduled_jobs`
- Kept existing in-memory adapters available for local/unit tests.
- Extended the worker runtime with `runOnce()` and optional durable queue/scheduler polling while preserving the existing queue-task and scheduled-task registration behavior.
- Added backend infrastructure APIs for implemented durable tables:
  - log listing and async log export task creation
  - file metadata listing/detail/delete-invalidating
  - in-app notification listing and read/archive/delete state changes
  - notification template list/create/update
  - scheduled task list/create/update/enable/disable/manual run enqueue
  - import/export task list/detail and async CSV export task creation
- Added API permission manifest entries and OpenAPI request/response schema mappings for the newly implemented infrastructure APIs.
- Added PostgreSQL-backed tests for database adapters and DB-backed infrastructure API persistence, with SQLite smoke coverage for adapter compatibility.
- Replaced frontend typed placeholders with real API fetches for implemented infrastructure pages: files, in-app notifications, scheduler, import/export task list, log pages, and online users. Pages still fall back to typed placeholders when no access token/API response is available.

Remaining base-system gaps are tracked in `docs/known_gaps.md`. The next recommended goal is to add confirmed schemas/APIs for system configuration, dictionaries, i18n management, announcements, webhook subscriptions, and optional external drivers only after their concrete configuration and persistence contracts are confirmed.

## System Management Module Progress

The system-management slice completed the following tested pieces:

- Added SQLite/PostgreSQL migrations and Drizzle schema tables for:
  - `system_configs`
  - `dictionary_types`
  - `dictionary_items`
  - `i18n_messages`
- Added a focused `apps/api/src/modules/system-management` API module with repository, service, and route boundaries instead of expanding the existing infrastructure module.
- Added backend APIs for the confirmed design-spec endpoints:
  - `GET /api/system-config`
  - `PATCH /api/system-config/:key`
  - `GET /api/dictionary-types`
  - `POST /api/dictionary-types`
  - `PATCH /api/dictionary-types/:id`
  - `GET /api/dictionary-types/:id/items`
  - `POST /api/dictionary-types/:id/items`
  - `PATCH /api/dictionary-items/:id`
  - `GET /api/i18n/messages`
  - `PATCH /api/i18n/messages/:id`
- Added API permission manifest entries, base permission manifest entries, and explicit OpenAPI request/response schemas for the implemented system-management APIs.
- Kept system configuration and dictionaries global in v1; tenant fields remain reserved and nullable, and organization-level overrides remain unimplemented as required.
- Avoided unconfirmed seed content for system configuration, dictionaries, and i18n messages.
- Added in-memory route coverage and PostgreSQL-backed persistence coverage for system config updates, dictionary type/item creation, and i18n message updates.
- Replaced frontend typed placeholders with real API fetches for the system configuration and dictionary management pages when an access token is available.

Remaining base-system gaps are tracked in `docs/known_gaps.md`. The next recommended goal is to implement announcements and webhook subscription APIs, then revisit optional SMTP/S3/Redis/RabbitMQ drivers only when their concrete package and configuration contracts are confirmed.

## Announcements and Webhook Subscription Progress

The communications slice completed the following tested pieces:

- Added SQLite/PostgreSQL migrations and Drizzle schema tables for:
  - `announcements`
  - `webhook_subscriptions`
- Added contract schemas for announcement create/update and webhook subscription create/update requests.
- Added backend APIs for the confirmed design-spec endpoints:
  - `GET /api/announcements`
  - `POST /api/announcements`
  - `PATCH /api/announcements/:id`
  - `POST /api/announcements/:id/publish`
  - `POST /api/announcements/:id/unpublish`
  - `GET /api/webhooks`
  - `POST /api/webhooks`
  - `PATCH /api/webhooks/:id`
- Added API permission manifest entries, base permission manifest entries, and explicit OpenAPI request/response schemas for the implemented communications APIs.
- Persisted webhook subscriptions without adding a mandatory webhook sender, retry worker, or external delivery dependency. API responses expose `secretConfigured` and do not return raw secrets.
- Kept announcement organization scoping to the confirmed `scope_type` value; no organization target field was added because no concrete organization-scope reference contract is confirmed.
- Added in-memory route coverage and PostgreSQL-backed persistence coverage for announcement creation/update/publish/unpublish and webhook subscription creation/update.
- Replaced the announcements frontend placeholder fetch with the real `/api/announcements` API when an access token is available. Dedicated management pages for announcements and webhook subscriptions are tracked in later frontend slices.
- Fixed shared JSON parameter handling so PostgreSQL JSONB array values persist correctly for webhook event types and existing infrastructure array fields.

Remaining base-system gaps are tracked in `docs/known_gaps.md`. SMTP has since been implemented as an optional configuration-driven channel; S3/Redis/RabbitMQ drivers still require concrete package and configuration contracts.

## Webhook Subscription Frontend Progress

The webhook subscription frontend slice completed the following:

- Added the `notifications.webhooks` frontend route metadata and menu binding under the Notifications group.
- Added the same webhook route/menu entry to the contracts base route and menu manifests for backend route/menu synchronization.
- Added a dedicated webhook subscription management page using TanStack Query for server state and TanStack Form plus Zod for create/edit validation.
- Wired the page to the existing backend APIs:
  - `GET /api/webhooks`
  - `POST /api/webhooks`
  - `PATCH /api/webhooks/:id`
- Added list, filter, create, edit, enable, and disable behavior for persisted webhook subscription records.
- Preserved the sensitive-field boundary: persisted raw secrets are never rendered; the UI only displays whether a secret is configured and allows setting/replacing a secret.
- Added frontend API/client and component coverage for listing, create/update requests, route rendering, and raw-secret non-display.

At this historical slice, outbound Webhook delivery and the listed optional drivers were still reserved. Later sections record their implementation status.

## Announcement Frontend Progress

The announcement frontend slice completed the following:

- Added the `notifications.announcements` route/menu entry to the contracts base route and menu manifests for backend route/menu synchronization.
- Added a dedicated announcement management page using TanStack Query for server state and TanStack Form plus Zod for create/edit validation.
- Wired the page to the existing backend APIs:
  - `GET /api/announcements`
  - `POST /api/announcements`
  - `PATCH /api/announcements/:id`
  - `POST /api/announcements/:id/publish`
  - `POST /api/announcements/:id/unpublish`
- Added list, filter, create, edit, publish, unpublish, loading, empty, error, and permission-denied behavior.
- Added frontend API/client and component coverage for listing, create/update requests, publish/unpublish requests, and route rendering.

Remaining base-system gaps are tracked in `docs/known_gaps.md`. Announcement delivery fan-out and concrete organization target references remain reserved until confirmed by the base contract.

## In-App Notification Frontend Progress

The in-app notification frontend slice completed the following:

- Added the `notifications.in-app` route/menu entry to the contracts base route and menu manifests for backend route/menu synchronization.
- Added a dedicated current-user in-app notification page using TanStack Query for server state.
- Wired the page to the existing backend APIs:
  - `GET /api/notifications`
  - `POST /api/notifications/:id/read`
  - `POST /api/notifications/:id/archive`
  - `DELETE /api/notifications/:id`
- Added list, filter, mark-read, archive, delete, loading, empty, error, and permission-denied behavior.
- Added frontend API/client and component coverage for listing, state update requests, and route rendering.

Remaining base-system gaps are tracked in `docs/known_gaps.md`. Notification creation and delivery fan-out remain backend/reserved concerns rather than a frontend create flow.

## Notification Template Frontend Progress

The notification template frontend slice completed the following:

- Added the `notifications.templates` frontend route metadata and menu binding under the Notifications group.
- Added the same notification-template route/menu entry to the contracts base route and menu manifests for backend route/menu synchronization.
- Added a dedicated notification template management page using TanStack Query for server state and TanStack Form plus Zod for create/edit validation.
- Wired the page to the existing backend APIs:
  - `GET /api/notification-templates`
  - `POST /api/notification-templates`
  - `PATCH /api/notification-templates/:id`
- Added list, filter, create, and edit behavior for persisted in-app, email, and reserved SMS template records.
- Added frontend API/client and component coverage for listing, create/update requests, route rendering, and template variable display.

At this historical slice, outbound Webhook delivery and the listed optional drivers were still reserved. Later sections record their implementation status; SMS sending remains reserved.

## i18n Message Frontend Progress

The i18n message frontend slice completed the following:

- Added the `system.i18nMessages` frontend route metadata and menu binding under the System group.
- Added the same i18n message route/menu entry to the contracts base route and menu manifests for backend route/menu synchronization.
- Added a dedicated i18n message management page using TanStack Query for server state and TanStack Form plus Zod for update validation.
- Wired the page to the existing backend APIs:
  - `GET /api/i18n/messages`
  - `PATCH /api/i18n/messages/:id`
- Added list, filter, edit, loading, empty, error, and permission-denied behavior for existing i18n message records.
- Added frontend API/client and component coverage for listing, update requests, and route rendering.

Remaining base-system gaps are tracked in `docs/known_gaps.md`. New i18n key creation remains manifest/module-driven rather than a frontend ad hoc create flow.

## File Management Frontend Progress

The file management frontend slice completed the following:

- Added the `system.files` route/menu entry to the contracts base route and menu manifests for backend route/menu synchronization.
- Added a dedicated file metadata management page using TanStack Query for server state.
- Wired the page to the existing backend APIs:
  - `GET /api/files`
  - `GET /api/files/:id`
  - `DELETE /api/files/:id`
- Added list, filter, detail, delete-invalidate, loading, empty, error, and permission-denied behavior for stored file metadata.
- Preserved the confirmed reference rule by showing referenced and invalid/deleted states without adding business-module-specific reference behavior.
- Added frontend API/client and component coverage for listing, detail fetch, delete-invalidate requests, and route rendering.

Remaining base-system gaps are tracked in `docs/known_gaps.md`. S3-compatible storage configuration UI and concrete S3 driver wiring remain reserved until their package/configuration contracts are confirmed.

## File Management Runtime Progress

The file management runtime slice completed the following:

- Added SQLite/PostgreSQL migrations and Drizzle schema for `file_references`.
- Added file permissions and API permission metadata for upload, download, image preview, and reference viewing.
- Added backend APIs:
  - `POST /api/files/upload`
  - `GET /api/files/:id/download`
  - `GET /api/files/:id/preview`
  - `GET /api/files/:id/references`
- Implemented local filesystem upload through `FileStorageAdapter`, including the confirmed default 50 MB limit and base whitelist.
- Kept PDF preview out of scope; image preview is supported for image content types.
- Updated the file management frontend page with upload, download, image preview, and reference display behavior.
- Added backend route/PostgreSQL persistence tests, SQLite migration coverage, OpenAPI manifest coverage, and frontend API/page tests.

Remaining base-system gaps are tracked in `docs/known_gaps.md`. S3-compatible storage remains reserved until its concrete client package and configuration contract are confirmed.

## Personal Center Persistence Progress

The personal center persistence slice completed the following:

- Added SQLite/PostgreSQL migrations and Drizzle schema for `user_preferences`.
- Added authenticated self-service backend APIs:
  - `GET /api/profile`
  - `PATCH /api/profile`
  - `PATCH /api/profile/preferences`
  - `POST /api/profile/avatar`
- Kept the avatar endpoint scoped to changing an existing file id reference; it does not re-upload files.
- Added API permission manifest entries without RBAC `requiredPermission`, matching the current-user self-service boundary.
- Added OpenAPI request/response schema coverage for the new profile and preference APIs.
- Added in-memory route tests and PostgreSQL reload tests for profile preference persistence.
- Replaced the static personal center and local-only personal settings UI with real API-backed React pages using TanStack Query and TanStack Form plus Zod.
- Synced saved preferences into Zustand layout/auth state for language, dark mode, theme color, and page-tab behavior.

Remaining base-system gaps are tracked in `docs/known_gaps.md`. Personal avatar upload itself remains part of the existing file upload module; the profile API only stores the selected file reference.

## SMTP Email Notification Progress

The SMTP email notification slice completed the following:

- Added an optional `NotificationChannelAdapter` SMTP driver over Node.js built-ins, with no mandatory external SMTP package dependency.
- Added SMTP runtime configuration through `SMTP_ENABLED`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, optional credentials, and `SMTP_FROM`.
- Added template rendering for email notification templates, supporting confirmed `{variable}` placeholders and the existing `{{variable}}` template style.
- Added authenticated backend test-send API:
  - `POST /api/notifications/email/test`
- Added API permission manifest metadata using the existing `notification-template:update` permission.
- Added OpenAPI request/response schema coverage for the test-send endpoint.
- Added in-memory route tests, PostgreSQL route tests for DB-backed template lookup, and SMTP adapter protocol tests against a local fake SMTP server.

At this historical slice, outbound Webhook delivery remained reserved. It is implemented in the later Webhook section; SMTP remains optional and SMS sending remains reserved.

## In-App Notification Dispatch Progress

The in-app notification dispatch slice completed the following:

- Added a shared queue payload contract for `notification.in_app.dispatch` jobs.
- Added internal infrastructure service support for queue-backed in-app notification creation from enabled `in_app` templates.
- Added user-recipient fan-out and organization-recipient fan-out boundaries with duplicate recipient normalization.
- Added worker task registration support for in-app notification dispatch jobs.
- Added dispatch execution that writes unread in-app notification records for each recipient.
- Kept public administrator notification creation APIs and frontend create flows out of scope because no base API contract confirms them.
- Added in-memory service coverage, worker task coverage, and PostgreSQL durable queue/notification persistence coverage.

Remaining base-system gaps are tracked in `docs/known_gaps.md`. Reliable outbound webhook delivery now follows ADR 0002; production destination acceptance remains pending. SMS sending and optional external integrations remain bounded by their documented contracts and deployment decisions.

## Worker Runtime Wiring Progress

The worker runtime wiring slice completed the following:

- Extended worker configuration with `DATABASE_DIALECT`, `DATABASE_URL`, and `WORKER_POLL_INTERVAL_MS`.
- Added a worker database executor for SQLite local/demo and PostgreSQL deployment databases.
- Wired worker startup to database-backed queue and scheduler adapters.
- Registered the implemented `notification.in_app.dispatch` task in the default worker application.
- Updated `main.ts` so process shutdown stops the runtime and closes owned database resources.
- Added worker bootstrap coverage proving a durable queue job is processed into persisted in-app notification records.

## Worker Queue and Scheduler Hardening Progress

The worker hardening slice completed the following:

- Added standard five-field cron expression evaluation for database-backed scheduled jobs and shared it with the infrastructure scheduled-task API.
- Updated scheduled-task creation, update, enablement, and worker registration so `next_run_at` is computed from the cron expression instead of forcing immediate repeated execution.
- Added database queue retry defaults using `attempt`, `max_attempts`, and `next_run_at`, with exhausted jobs moved to the existing `dead_letter` status.
- Added stale running queue-job recovery using the stored lock timestamp and a bounded running timeout.
- Added scheduler execution claiming with a bounded lease, retry delay handling for failed executions, max-attempt exhaustion per scheduled occurrence, and execution log writes to `log_entries` with `log_type = 'scheduler'`.
- Added adapter coverage for cron calculation, queue retry/dead-letter status, stale running queue recovery, scheduled success next-run advancement, scheduled failure retry exhaustion, and scheduler execution logs.

## Base Worker Task Catalog Progress

The base worker task catalog slice completed the following:

- Added a default worker task catalog that registers confirmed base queue tasks and scheduled tasks at worker startup.
- Added `scheduled.run` queue handling so manual scheduled task runs execute registered base handlers by scheduled-task id or handler type.
- Added log retention cleanup using the confirmed default 90-day retention boundary for all implemented log types.
- Added local invalid-file cleanup through `FileStorageAdapter.delete`, keeping metadata invalid rather than removing historical records.
- Added CSV log export execution for confirmed `logs:<logType>` import/export tasks. Export results are stored through `FileStorageAdapter`, persisted in `file_objects`, and linked back to `import_export_tasks`.
- Added import/export result cleanup for expired result/error files using the existing 30-day result retention boundary.
- Kept unknown import/export resource types from silently succeeding; unsupported resources are marked failed with an error preview instead of inventing business-module handlers.
- Added worker integration coverage for CSV log export, manual scheduled runs, log retention cleanup, invalid file cleanup, result cleanup, and default task registration.

At this historical slice, outbound Webhook delivery and the listed optional drivers remained reserved. Later sections record their implementation status; future business-module catalogs and SMS remain outside scope.

## Final Consistency Hardening Progress

The verification hardening slice completed the following:

- Restored the PostgreSQL verification path using the externally provided `TEST_DATABASE_URL`.
- Fixed database queue timestamp parameter binding for PostgreSQL by casting timestamp placeholders to `timestamptz` while keeping SQLite placeholder behavior unchanged.
- Confirmed PostgreSQL migrations apply through `pnpm db:migrate:postgresql`.
- Confirmed SQLite and PostgreSQL migrations apply through `pnpm db:migrate`.
- Stabilized frontend app tests by unmounting rendered React trees before resetting shared Zustand state and by returning fresh mocked `Response` objects for repeated API calls.
- Removed the React `act(...)` warning noise from the frontend app test run.
- Added Vite manual vendor chunking for React, TanStack, icon, and shared vendor dependencies so the frontend production build no longer emits the single large chunk warning.
- Reworked `docs/known_gaps.md` so it records only validation prerequisites, explicit implementation boundaries, reserved optional integrations, and remaining documentation/schema coverage debt.

The system remains free of example business modules and SQL Server runtime/migration support. Remaining optional integrations and unconfirmed contracts are tracked in `docs/known_gaps.md`.

## Backend-Core OpenAPI Response Schema Progress

The backend-core OpenAPI coverage slice completed the following:

- Added focused backend-core OpenAPI schema modules for shared helpers, core entities, and response envelopes instead of expanding the existing large generic schema file.
- Added named response schemas for initialization, auth/session context, organization, user, user-organization-role binding, role, role permissions, permission metadata, API permission metadata, route metadata, menus, and menu/API bindings.
- Mapped older backend-core operation codes to named OpenAPI response components so those endpoints no longer fall back to the generic response envelope.
- Added OpenAPI tests that require backend-core API responses to use named component schemas and verify mapped response references resolve to existing components.
- Updated `docs/known_gaps.md` to remove the old backend-core generic-envelope gap.

## Infrastructure OpenAPI Response Schema Progress

The infrastructure OpenAPI coverage slice completed the following:

- Added concrete OpenAPI component schemas for log entries, file objects, file references, in-app notifications, notification templates, scheduled tasks, import/export tasks, and SMTP email test-send results.
- Replaced broad object response items for infrastructure list/detail APIs with named item schemas and nullable entity envelopes where the API can return `null`.
- Kept explicitly flexible fields such as `metadata`, scheduled-task `payload`, import/export `errorPreview`, and email template variables as open object/map structures.
- Added OpenAPI tests that require infrastructure list responses to reference concrete item schemas and verify those item schemas define required fields with `additionalProperties: false`.
- Updated `docs/known_gaps.md` to remove the infrastructure broad-item response schema debt.

## Local Run Documentation Hardening Progress

The local run documentation slice completed the following:

- Expanded `.env.example` with the currently used DB-backed runtime, worker, file-storage, SMTP, seed, and PostgreSQL test variables.
- Added a concise persistent SQLite local run path to `README.md` and `docs/local_development_guide.md`.
- Clarified that the runtime reads process environment variables directly and that `.env.example` is a checklist, not an automatically loaded file.
- Updated deployment guidance with the PostgreSQL migration/build/start order and the static SPA serving requirement.
- Updated the database migration guide to describe the current ordered migration directories instead of only the original `0001` migration.
- Corrected the permission extension guide to reflect that DB-backed permission and route sync endpoints now persist when `BACKEND_CORE_STORE=database`.
- Reclassified the remaining OpenAPI flexible-map note in `docs/known_gaps.md` as a schema boundary rather than documentation debt.

## Local End-to-End Smoke Progress

The local smoke slice completed the following:

- Ran a DB-backed SQLite migration and seed flow against `data/smoke-e2e.sqlite`.
- Fixed relative SQLite file URL resolution so root `pnpm` migration, API, seed, and worker commands resolve the same local database through the original command directory.
- Added Vite dev-server `/api` proxy support through `VITE_API_PROXY_TARGET` and `WEB_PORT`.
- Replaced the frontend demo login/password-change stubs with real backend API calls.
- Updated frontend generic management-page endpoint mapping for users, organizations, roles, permissions, menus, and scheduler logs.
- Verified live API, live Vite web server, Vite `/api` proxy, login context, OpenAPI, core management APIs, files, announcements, webhooks, logs, scheduled tasks, and import/export task list over HTTP.

## Core Management UI Productization Progress

The core management UI slice completed the following:

- Added a focused `features/core-management` frontend module for users, organizations, roles, permissions, and menus.
- Replaced the generic placeholder management page for those core routes with real API-backed React pages.
- Added list/search/loading/empty/error states and create/edit side-panel forms for users, organizations, roles, and menus.
- Added lifecycle table actions for user status, user password reset, organization enable/disable/delete, role enable/disable/copy/delete, and menu delete.
- Added role permission assignment through the existing role-permissions API.
- Added menu API-permission binding through the existing menu API-binding API.
- Added permission manifest sync access on the permission page when the current user has `permission:sync`.
- Added frontend API and component coverage for the new core management API/page behavior.

## Operations and Logs UI Productization Progress

The operations and logs frontend slice completed the following:

- Added dedicated frontend operation pages for online users, scheduled tasks, and import/export tasks.
- Kept online users read-only, matching the confirmed v1 boundary that kick-out is reserved.
- Wired scheduled task management to the existing backend APIs for list, create, update, enable/disable, and manual run.
- Wired import/export task management to the existing backend APIs for task list, task detail, and asynchronous CSV export task creation.
- Added a reusable log management page for login, operation, access, API call, exception, security, scheduler, and file operation logs.
- Wired log pages to the implemented backend log endpoints and `POST /api/logs/export`, creating asynchronous CSV export tasks instead of direct downloads.
- Added frontend API and route rendering coverage for the newly productized operation and log pages.

## System Configuration and Dictionary UI Productization Progress

The system configuration and dictionary frontend slice completed the following:

- Added a dedicated system configuration page using TanStack Query and TanStack Form over the existing backend APIs.
- Kept configuration creation out of scope; the page only edits existing editable global configuration records and preserves the v1 global-only boundary.
- Added typed value editing for string, number, boolean, and JSON configuration values.
- Added a dedicated dictionary management page for global dictionary types and dictionary items.
- Wired dictionary type and item list/create/update/status flows to the existing backend APIs.
- Kept organization-level dictionary overrides and ad hoc i18n key creation reserved.
- Added frontend API and route rendering coverage for the new system configuration and dictionary pages.

## Local Browser Smoke Hardening Progress

The local browser smoke hardening slice completed the following:

- Ran the local SQLite DB-backed API, Vite web app, and worker together against `data/ui-smoke.sqlite`.
- Re-seeded the DB-backed runtime and found that the shared route/menu manifests lagged behind the implemented frontend routes.
- Expanded `baseRouteManifest` and `baseMenuManifest` to include system configuration, dictionaries, operations, logs, and account pages so seed/login menu context exposes the implemented base pages.
- Added frontend manifest alignment coverage so every menu-visible frontend admin route must exist in the shared base route and menu manifests.
- Fixed the login form label structure to use explicit `htmlFor`/`id` pairs, avoiding ambiguous password input and password-visibility button labeling.
- Fixed sidebar and tab active state matching to require exact route matches, preventing the dashboard root route from appearing active on every admin page.
- Verified live health, login, menu context, core/system/operations/logs/files/notifications/webhook APIs, and a system Chrome browser smoke through Vite.

Remaining implementation boundaries are tracked in `docs/known_gaps.md`; this slice did not add example business modules, SQL Server support, or optional external integration drivers.

## Repeatable Local Smoke Script Progress

The repeatable local smoke slice completed the following:

- Added `pnpm smoke:local` backed by the focused modules in `scripts/local-smoke/`.
- Automated SQLite migration, DB-backed seed initialization, API/Web/Worker startup, readiness checks, authenticated API smoke checks, and browser login/navigation checks.
- Covered menu manifest synchronization by asserting implemented system, operations, logs, and account menus are present after login.
- Covered the admin shell active-link behavior by asserting only the current sidebar route is active after navigating to system configuration.
- Added local smoke documentation to `README.md` and `docs/local_development_guide.md`.
- Ignored generated `.tmp/` and root `data/` smoke artifacts so local validation output is not accidentally committed.

The script keeps optional integrations disabled by default and does not add example business modules or SQL Server support.

## Unified Verification Script Progress

The unified verification slice completed the following:

- Added root `pnpm verify` as the complete local quality gate.
- Chained format, lint, typecheck, tests, SQLite/PostgreSQL migrations, local smoke, and production build in fail-fast order.
- Documented the `TEST_DATABASE_URL` / `DATABASE_URL` prerequisite for the PostgreSQL migration step in `README.md` and `docs/local_development_guide.md`.

## CI Verification Progress

The CI verification slice completed the following:

- Added GitHub Actions workflow `.github/workflows/verify.yml`.
- Runs PostgreSQL 16 as a CI service and provides `TEST_DATABASE_URL` for PostgreSQL tests and migrations.
- Installs dependencies with pnpm 10.13.1 and Node.js 22, installs Playwright Chromium for the browser smoke check, and executes the same `pnpm verify` quality gate used locally.
- Keeps optional Redis, RabbitMQ, S3-compatible storage, SMTP, SMS, and outbound webhook integrations disabled by default in CI.

## Local Run Acceptance Progress

The local run acceptance slice completed the following:

- Added `docs/local_run_acceptance.md` as the reproducible local acceptance runbook.
- Documented automated acceptance through `pnpm verify` and `pnpm smoke:local`.
- Documented the persistent SQLite manual run path with seed credentials, worker startup, browser page checklist, API documentation check, evidence to record, and cleanup steps.
- At that time, kept optional integrations outside acceptance; current Webhook acceptance remains optional and is documented separately.

## Deployment Acceptance Progress

The deployment acceptance slice completed the following:

- Added `docs/deployment_acceptance.md` as the PostgreSQL-backed deployment acceptance runbook.
- Documented required production variables, deployment order, initialization choices, static SPA serving requirements, API checks, browser checks, worker checks, security/consistency checks, and acceptance evidence.
- Added rollback and troubleshooting entry points for migration, login, worker, file access, OpenAPI, and permission consistency failures.
- Kept optional integrations outside required deployment acceptance; current S3 and Webhook acceptance sections remain opt-in.

## Release Readiness Progress

The release readiness slice completed the following:

- Added `docs/release_readiness.md` as the final go/no-go entry point for handoff or release decisions.
- Linked local acceptance, deployment acceptance, CI verification, unified `pnpm verify`, known-gaps review, Node.js-only runtime, SQLite local/demo support, PostgreSQL deployment support, no SQL Server support, no example business module, adapter abstraction checks, and optional integration status into one checklist.
- Documented evidence to record and Go, No-Go, and Conditional Go decision outcomes.

## Release Readiness Record Progress

The first release readiness record slice completed the following:

- Added `docs/release_readiness_records/2026-07-06-base-system.md`.
- Recorded audited commit `708b6ee`, local OS, Node.js, pnpm, `pnpm verify` result, SQLite/PostgreSQL migration result, local smoke result, SQL Server scan, example business-module scan, known-gaps review, and Go/No-Go decision.
- Marked target-environment deployment acceptance and hosted CI run observation as follow-up evidence to collect when a staging/production-like environment or hosted branch is available.

## README Runbook Navigation Progress

The README navigation slice completed the following:

- Added a `Project Runbooks` section organized by role and task.
- Linked new developers, local operators, CI maintainers, deployment operators, release owners, business-module developers, adapter extenders, permission extenders, and troubleshooters to the relevant command or runbook.
- Kept the full guide index while adding `.github/workflows/verify.yml` and `docs/release_readiness_records/` as explicit navigation entries.

## Base System Status Matrix Progress

The base-system status matrix slice completed the following:

- Added `docs/base_system_status_matrix.md` as a handoff-oriented module status overview.
- Summarized backend, frontend, persistence, tests/verification, known boundary/gap, and main documentation links for core foundation, infrastructure, communication, file, OpenAPI, CI, and readiness modules.
- Linked the matrix from the README guide index and kept `docs/known_gaps.md` as the authoritative source for incomplete, reserved, or environment-dependent work.

## One-Command Local Startup Progress

The one-command local startup slice completed the following:

- Added `scripts/start-local-dev.ps1` with detailed comments and configurable parameters for administrator password, SQLite database URL, file storage root, API port, Web port, worker polling, install skip, and seed skip.
- Added root `pnpm dev:local` as a convenience wrapper for the PowerShell startup script.
- Updated README, local development guide, and local run acceptance guide so users can start the local SQLite API/Web/Worker stack and open the printed browser URL without manually setting every environment variable.

## Admin Sidebar Navigation Progress

The admin sidebar navigation slice completed the following:

- Changed first-level admin menu groups from always-expanded sections to collapsible groups.
- Kept the current route's group automatically expanded so page context remains visible after navigation or refresh.
- Preserved multiple expanded groups and stored the user's expanded group choices in browser local storage.
- Updated frontend tests and local browser smoke checks so validation reflects the collapsible sidebar behavior.

## Production Deployment Acceptance Progress

The production deployment acceptance slice completed the following:

- Reproduced a PostgreSQL-backed deployment acceptance flow against a fresh `tripley_mis_acceptance` database.
- Found and fixed the Node ESM production start path for API and worker services by bundling their built entrypoints with esbuild while keeping `start` as `node dist/main.js`.
- Verified production-built API, worker, and static SPA serving with `/api` reverse proxy behavior.
- Confirmed API health, metrics, OpenAPI, login, core API checks, asynchronous log export task creation, and browser navigation through representative admin pages.

## Optional Redis and RabbitMQ Adapter Progress

The optional external adapter slice completed the following:

- Added optional Redis cache and rate-limit adapter drivers behind the existing `CacheAdapter` and `RateLimitAdapter` interfaces.
- Added optional RabbitMQ queue and event-bus adapter drivers behind the existing `QueueAdapter` and `EventBusAdapter` interfaces.
- Kept Redis and RabbitMQ disabled for default local startup, CI, deployment acceptance, API runtime, and worker runtime unless a future runtime-wiring goal explicitly opts in.
- Added `scripts/start-optional-integrations.ps1` to start lightweight Docker Desktop development containers using `redis:8.8.0-alpine` and `rabbitmq:4.3.2-alpine`.
- Added `pnpm test:optional-integrations` with tests gated by `REDIS_URL` and `RABBITMQ_URL`, so normal `pnpm test` skips the external-driver coverage when the services are absent.
- Verified the optional Redis and RabbitMQ adapter tests against local Docker containers.

## Optional Adapter Runtime Wiring Progress

The optional adapter runtime-wiring slice completed the following:

- Added validated API runtime configuration for `CACHE_DRIVER`, `RATE_LIMIT_DRIVER`, `QUEUE_DRIVER`, `EVENT_BUS_DRIVER`, `REDIS_URL`, and `RABBITMQ_URL`.
- Wired DB-backed API dependencies so `CACHE_DRIVER=database` uses the existing `cache_entries` table and `CACHE_DRIVER=redis` uses the optional Redis cache adapter for backend permission-cache storage.
- Wired DB-backed API infrastructure so `QUEUE_DRIVER=rabbitmq` can enqueue adapter-backed jobs through RabbitMQ while default `QUEUE_DRIVER=database` preserves the existing durable database queue behavior.
- Added worker runtime configuration for `QUEUE_DRIVER=rabbitmq`; the worker registers RabbitMQ consumers for adapter-backed jobs while still processing database durable queue and scheduler work for scheduled tasks, import/export, and log-export flows.
- Added configuration tests proving external drivers require `REDIS_URL` or `RABBITMQ_URL` only when explicitly selected.

## S3-Compatible File Storage Design Progress

The next file-storage goal has a confirmed implementation contract:

- Use AWS SDK v3 behind the existing `FileStorageAdapter`; keep local filesystem storage as the default.
- Keep buckets private and authorize downloads through the backend before redirecting S3-backed requests to a 60-second presigned URL.
- Persist each file's storage driver, optional bucket, and complete object key so local and S3 historical files remain accessible after the active upload driver changes.
- Provision production buckets outside the application; permit automatic bucket creation only through explicit development/test configuration.
- Invalidate file metadata and references before asynchronous physical content deletion, record content-deletion completion, and compensate storage writes when metadata persistence fails.
- Share validated `FILE_STORAGE_DRIVER` and `S3_*` configuration between API and worker runtimes, with either explicit credentials or the AWS SDK default credential chain.
- Use pinned `rustfs/rustfs:1.0.0-beta.8` only as the optional Docker-backed S3 compatibility-test backend. Do not use RustFS-specific APIs or select it as the production provider.
- Keep ordinary tests and push CI independent of external object storage; expose a local integration command and manually triggered workflow for the real RustFS compatibility suite.

## S3-Compatible File Storage Implementation Progress

The confirmed ADR contract is now implemented:

- Added an AWS SDK v3 S3-compatible adapter with custom endpoint, path-style, explicit/default-chain credentials, bucket health validation, explicit development/test bucket creation, put/get/delete, and private presigned GET support.
- Added shared API/worker configuration and mixed local/S3 routing based on each persisted Object Location. `FILE_STORAGE_DRIVER` controls new writes only.
- Added `storage_bucket` and `content_deleted_at` to SQLite/PostgreSQL schemas and migrations, with idempotent migration tracking.
- Added authenticated S3 download/preview redirects, 15-900 second TTL validation with a 60-second default, metadata-failure upload compensation, and asynchronous physical deletion with later retry after failures.
- Updated import/export result storage and worker cleanup to route through recorded driver, bucket, and complete key.
- Added unit, API, worker, SQLite, PostgreSQL persistence, and real RustFS compatibility coverage.
- Added `scripts/rustfs-dev.ps1`, `pnpm test:s3-integration`, and a manually triggered `S3 Compatibility` workflow using `rustfs/rustfs:1.0.0-beta.8` at a verified 256 MB limit.

Production object-storage provider selection and target-environment deployment acceptance remain pending until that environment is ready. Direct browser uploads, multipart upload, automatic historical migration, and an S3 configuration UI remain outside this goal.

## Reliable Outbound Webhook Delivery Progress

The confirmed design in `docs/webhook_delivery_design.md` and ADR 0002 is implemented:

- Added the controlled event catalog and strict CloudEvents-compatible payload contracts for user creation, exhausted jobs, permission changes, and directed notification requests.
- Added transactional backend-core/queue/scheduler Outbox production with no-op mutation suppression and recursion exclusion for Webhook pipeline jobs.
- Added durable subscription revisions, delivery records, immutable attempts, idempotent fan-out, PostgreSQL concurrent claims, stale-running recovery, bounded retries, and database-locked retention cleanup.
- Added AES-256-GCM secret storage/rotation tooling, HMAC-SHA256 signatures, HTTPS/SSRF/DNS-pinning controls, redirect rejection, response limits, safe structured logs, and a no-op-by-default alert boundary.
- Added subscription deletion, controlled event catalog, delivery list/detail APIs, explicit OpenAPI schemas/query parameters, Hono RPC inference checks, and API permission metadata.
- Added Subscriptions/Deliveries frontend tabs, controlled event selection, delivery filters/details, bilingual labels, mutation states, and sensitive-data non-disclosure.
- Added SQLite migrations and smoke tests plus PostgreSQL, adapter, Worker, API, frontend, key migration, local HTTP receiver, retry, concurrency, revision cancellation, directed notification, and retention coverage.

Delivery remains disabled by default and requires matching API/Worker `WEBHOOK_*` configuration. Manual replay/cancel/export, custom headers, a separate Webhook dead-letter queue, a public arbitrary-notification API, and automatic subscription disabling are outside the confirmed v1 contract. Target-environment destination acceptance remains pending until that environment is ready.

## Reliable Email Delivery Design Progress

The next recommended implementation goal has a confirmed contract in `docs/email_delivery_design.md` and ADR 0003:

- Accept one internal, idempotent Email Notification Request per enabled User without exposing a public arbitrary-email API.
- Resolve the User's Effective Language, require an exact enabled Email Template, validate its strict variable contract, and persist an encrypted rendered snapshot.
- Use dedicated Email Delivery and Attempt records as the only durable Worker claim, retry, recovery, and history authority.
- Provide bounded at-least-once SMTP retries with a stable Message ID, stale-running recovery, safe final alerts, immediate terminal content purge, and database-locked retention cleanup.
- Require implicit TLS or STARTTLS for remote SMTP and permit insecure plaintext only for explicitly configured development/test loopback servers.
- Add safe read-only management APIs/UI, OpenAPI and Hono RPC coverage, PostgreSQL tests, SQLite migration smoke, a development-only request CLI, and optional pinned Mailpit compatibility tooling.
- Keep reliable delivery and SMTP transport disabled independently by default. Production SMTP provider selection and target-environment acceptance remain pending.

Do not add business-module triggers, default email templates, a public create API, HTML/attachments, manual retry/cancel/export, bounce tracking, SMS sending, or a separate email DLQ in this goal.

## Reliable Email Delivery Implementation Progress

The confirmed ADR 0003 contract is implemented:

- Added dedicated SQLite/PostgreSQL Email Delivery and Attempt persistence, exact channel/code/locale template identity, strict template variables, idempotent internal requests, Effective Language resolution, encrypted rendered snapshots, and stable Message IDs.
- Added Worker concurrent claims, SMTP Acceptance outcomes, bounded retry, stale recovery, deleted-User cancellation, missing-key health checks, corruption final failure, safe alerts/logs, immediate terminal content purge, and distributed-lock retention cleanup.
- Hardened SMTP with implicit TLS or mandatory STARTTLS for remote hosts. Plaintext is limited to an explicit loopback development/test exception.
- Added read-only permissioned list/detail APIs, explicit OpenAPI schemas, route/menu metadata, and a bilingual safe-history frontend page.
- Added development-only request tooling, scan/apply content-key rotation tooling, a pinned 128 MB Mailpit environment, `pnpm test:smtp-integration`, and a manual compatibility workflow.

Reliable email and SMTP remain independently disabled by default. Production provider selection, key custody, and target-environment acceptance remain pending.

## Organization-Scoped Announcement Implementation Progress

The contract in `docs/announcement_targeting_design.md` and ADR 0004 is implemented:

- Added SQLite/PostgreSQL expiration and durable multi-Organization target persistence with auto-increment IDs, uniqueness, target-type enforcement, and transactional replacement.
- Added strict scope/target validation, minimal ancestor/descendant target sets, draft-only edit/delete, publish-time revalidation, immediate publish/unpublish, UTC publication time, and read-time expiration.
- Added the permissioned paginated Announcement Catalog and authenticated Current Announcements endpoint with dynamic current-Organization subtree visibility and no recipient snapshots.
- Added `announcement:delete`, API/permission/route metadata, explicit OpenAPI request/query/response coverage, and Hono RPC inference checks.
- Added the bilingual management UI with Organization target tree, expiration, filters, pagination, lifecycle-aware actions, deletion, and the top-bar Current Announcements panel.
- Wired frontend Organization switching to the backend context API and invalidated server queries so menus, permissions, data, and Current Announcements reload together.
- Added contract, in-memory API, PostgreSQL persistence/reload, migration, manifest/OpenAPI, Hono RPC, API-client, and frontend component coverage.

Publication remains independent from in-app Notification, email, SMS, and Webhook delivery. Scheduled publication, approval, role/user targets, title search, and per-user Announcement state remain outside the confirmed scope.

## Business Module Extension Design Progress

ADR 0005 and `docs/business_module_extension_design.md` now define the confirmed future-module extension architecture:

- Explicit static Business Module registration with permanent namespaced identities and no runtime plugin discovery, installation, or inter-module dependency graph.
- Serializable definitions separated from typed Hono, TanStack file-route, Worker, and database runtime registrations.
- Build-time bidirectional conformance, an empty production Business Module Registry, isolated test fixtures, and retained Hono RPC inference.
- Append-only, checksummed SQLite/PostgreSQL module migration sources with module-owned table namespaces.
- Administrator-reviewed Module Sync Plans, dual definition/activation hashes, fail-closed per-module activation, retained data on removal, and a Module Registry management page.
- Executable fail-closed data/field permissions and narrow capability ports for logs, files, CSV, events, notifications, jobs, errors, i18n, and observability.

## Business Module Registry And Conformance Foundation

Phase 1 of the confirmed ADR 0005 design is implemented:

- Added strict serializable `BusinessModuleDefinition` and Localized Message contracts with normalized empty contribution collections.
- Added `packages/module-sdk` with `defineBusinessModule`, static registry composition, canonical SHA-256 `definitionHash`/`activationHash`, namespace and ownership validation, reference checks, runtime parity checks, deterministic diagnostics, and test helpers.
- Wrapped existing Base System permission/API/route/menu identifiers in a trusted compatibility definition without renaming them.
- Added explicit empty production registries for API, Web, Worker, definitions, and database migrations. The API keeps an explicit typed Hono composition point and existing `ApiApp` RPC inference.
- Added `pnpm modules:check`, human and JSON diagnostics, deterministic generated module/migration metadata, and execution from build and `pnpm verify`/normal Verify CI.
- Added module-aware SQLite/PostgreSQL migration sources with Base-first ordering, namespaced module IDs, dialect parity checks, SHA-256 history checks, append-only enforcement, and explicit legacy-history failure.
- Rebuilt the internal development SQLite/PostgreSQL databases for the new migration history shape without adding an automatic destructive reset to normal migration commands.
- Added isolated valid/invalid synthetic fixtures and tests for contracts, hashes, namespace/ownership/reference diagnostics, API/Web/Worker mismatch, Hono RPC inference, fixture leakage, migration ordering/parity/checksums, SQLite execution, and PostgreSQL persistence.

Production Business Module registries remain empty. Phase 4 Capability Ports are implemented in the later section below.

## Business Module Registry Lifecycle And Admin Sync

Phase 2 of the confirmed ADR 0005 design is implemented:

- Added SQLite/PostgreSQL accepted registry state and entries with immutable definition snapshots, definition/activation hashes, accepted actor/time, and retained disabled history.
- Added deterministic read-only catalog/plan services and confirmed transactional Apply with stale-hash rejection, dictionary dependency validation, authorization-binding removal reporting, idempotency, audit logs, and permission-cache invalidation.
- Added owned metadata synchronization for permissions, API permissions, routes, menus, and Localized Messages. Default messages and administrator overrides persist separately, and removed module metadata is disabled rather than deleted.
- Added first-start and seed dependency preflight/bootstrap while keeping normal startup read-only. Existing permission/route manifest sync endpoints delegate to the complete registry metadata transaction.
- Added fail-closed API activation before authorization, active metadata/menu filtering, and shared active-registration selection for Web/Worker composition.
- Added `GET /api/modules/registry`, `POST /api/modules/sync/plan`, and `POST /api/modules/sync/apply` with permission manifests, explicit OpenAPI schemas, stable errors, and Hono RPC inference.
- Added read-only-by-default `pnpm modules:sync` CLI with explicit reviewed-hash and confirmation flags for Apply.
- Added the bilingual `/system/modules` catalog and plan UI with contribution/dependency/drift visibility, permission-denied/loading/empty/error/mutation states, and confirmed Apply.
- Added contract, plan/service, rollback, initialization, activation, Hono RPC, OpenAPI, SQLite migration, PostgreSQL persistence/reload, fixture isolation, CLI, API-client, and frontend component coverage.

Phase 3 executable data and field permissions is implemented in the following section. Phase 4 Capability Ports are implemented after it.

## Executable Business Module Data And Field Permissions

Phase 3 of the confirmed ADR 0005 design is implemented according to ADR 0006:

- Added strict version 1 data-permission rule contracts, base operator codes, neutral predicate contracts, field scenarios, and strict role permission update schemas.
- Added fail-closed compilation for global/policy resources, effective permission grants after user overrides, Super Administrator bypass, base/custom operators, allow union minus deny union, and declared-field validation.
- Added parameterized Drizzle predicate translation with explicit column maps and real SQLite/PostgreSQL execution coverage, including injection-shaped values.
- Upgraded role data/field permission persistence for multiple allow/deny records and `resource + field + scenario` uniqueness through migrations 0013-0014.
- Added scenario-aware response filtering and create/edit write rejection, with `PERMISSION_FIELD_DENIED` authorization normalization at the Hono API boundary.
- Extended Business Module declarations and conformance with resource permission/type checks, resource field checks, API request/response scenarios, custom operator ownership, and bidirectional API runtime registration.
- Added effective field permissions and Super Administrator state to login, Organization-switch, and current permission contexts, plus Zustand storage and frontend visibility/writability helpers.
- Kept every production Business Module registry empty; all executable query examples remain isolated under test fixture directories.

## Business Module Capability Ports

Phase 4 is implemented according to ADR 0007:

- Added strict Module Execution Context, asynchronous message, Operation Event, Managed File reference, and CSV task contracts.
- Added `packages/module-sdk` capability runtimes for declared permissions, Operation Events, typed module errors, Managed Files, CSV tasks, Domain/Notification Events, clock/ID services, and bounded background jobs.
- Extended API/Worker registrations with explicit Zod schemas, file authorizers, CSV handlers, notification recipient resolvers, and job handlers; `pnpm modules:check` validates declaration/runtime parity and capability limits.
- Added DB-backed capability bindings for durable File References, idempotent CSV tasks, Outbox events, queue jobs, asynchronous Operation Logs, and a local JSONL fallback when Queue publication is unavailable.
- Added authenticated module-reference File download/preview authorization while preserving the global file permissions and existing local/S3 response behavior.
- Added active-module controlled Webhook event catalogs for Domain and Notification Events, with durable Worker fan-out through the existing delivery aggregate.
- Added Worker CSV execution, full import error reports, formula-safe explicit-field exports, Operation Log writing, context reconstruction, timeout cancellation, singleton locking, and active-registration loading.
- Added a shared Base scheduled-job catalog and API validation so unknown or inactive module handlers cannot be created, enabled, or run immediately; module removal disables retained schedules.
- Added SQLite/PostgreSQL migrations 0015-0016 for Outbox/CSV idempotency and context plus final in-app Notification request deduplication.
- Added contracts/module-sdk/API/Worker/SQLite/PostgreSQL tests for fail-closed capabilities, context propagation, idempotency, active-module gates, File authorization, queue fallback, CSV output, Outbox/Webhook fan-out, migrations, and fixture isolation.

All four Business Module extension-foundation phases are implemented. Production API, Web, Worker, definition, and database registries remain intentionally empty; no example or production Business Module is included.

## Business Module Extension Acceptance Progress

- Added `pnpm test:business-module-acceptance` as a focused, cross-platform acceptance command for the four extension-foundation phases.
- Kept every synthetic definition and runtime registration under test directories while checking that all production registries remain empty.
- Covered Module Sync and activation, executable permissions, Managed Files, CSV, Operation/Domain/Notification Events, Webhook fan-out, background/scheduled jobs, Hono RPC, Worker execution, PostgreSQL persistence, and frontend integration.
- Added `docs/business_module_acceptance.md` and a dated release-readiness record so extension changes have a reproducible pre-merge gate in addition to `pnpm verify`.
