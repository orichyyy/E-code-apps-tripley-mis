# Business Module Extension Guide

No example Business Module is implemented in the Base System. The production registries intentionally contain zero modules.

The authoritative architecture is recorded in ADRs 0005-0006 and `docs/business_module_extension_design.md`. Phase 1 registry/conformance, Phase 2 lifecycle/Admin Sync, and Phase 3 executable data/field permissions are implemented. Capability ports remain a later phase.

## Static Composition

A module is compiled into a release through explicit registration. Runtime directory scanning, package discovery, installation, module enable switches, and inter-business-module dependencies are not supported.

The serializable definition belongs in the owning module package and is created with `defineBusinessModule`. Runtime values remain separate:

- API registry: `apps/api/src/business-modules/registry.ts`
- API Hono composition: `apps/api/src/business-modules/routes.ts`
- Web registry: `apps/web/src/business-modules/registry.ts`
- Worker registry: `apps/worker/src/business-modules/registry.ts`
- Database migration registry: `packages/db/src/business-modules/registry.ts`
- Production definitions: `packages/contracts/src/business-modules/production-registry.ts`

Every registry entry links through the same immutable `moduleCode`. Adding a declaration without its runtime implementation, or mounting an implementation without a declaration, fails `pnpm modules:check`.

## Definition Contract

Use `defineBusinessModule` from `@web-admin-base/module-sdk`. A definition requires:

- `contractVersion: 1`
- a globally unique lower-kebab `moduleCode`
- a canonical BCP 47 `defaultLocale`
- a Localized Message title with `key` and `defaultMessage`

Unused contribution collections normalize to empty arrays. Definitions are serializable and must not contain routers, handlers, React components, Zod runtime schema objects, Drizzle mappings, or callbacks.

User-facing text uses Localized Message descriptors. A module that serves only one locale still supplies a stable namespaced key and its local-language `defaultMessage`; it does not use magic prefixes or a second literal title property.

## Namespaces

The permanent Module Code owns these identifiers:

```text
permission:       <moduleCode>.<resource>:<action>
API operation:    api.<moduleCode>.<operation>
route/menu/event: <moduleCode>.<local-code>
import/export:    <moduleCode>:<resource>
i18n:             modules.<moduleCode>.<key>
error:            BUSINESS_<MODULE_CODE_UPPER_SNAKE>_<LOCAL_CODE>
frontend path:    /modules/<moduleCode>/...
API path:         /api/modules/<moduleCode>/...
table:            <module_code_with_underscores>__<local_table>
```

A module may reference confirmed Base System public contracts, including an allowed Base menu parent, but cannot own or mutate another Business Module's identifiers.

## API, Web, And Worker Registration

API modules export typed Hono routers and are added through the explicit `.route()` composition in `createBusinessModuleRoutes`. Keep the final `ApiApp` type intact so frontend Hono RPC inference remains available. Each declared API must have a matching method/path registration and mounted Hono route.

Web declarations use `/modules/<moduleCode>/...` paths and must match the route metadata that feeds the TanStack route tree. Runtime component injection is not supported.

Scheduled jobs and import/export resource types require matching Worker handler registrations. A handler registration with no declaration is also a conformance error.

## Executable Data Permissions

Each Data Resource declares `accessModel`, a dedicated `data` permission through
`permissionCode`, its queryable fields, and optional owner/Organization fields.
Policy resources are fail-closed. Call `createBusinessPermissionEnforcer` with the
compiled definitions and explicitly registered custom operator handlers, then pass
the resulting neutral predicate to `toDrizzleDataPredicate` with the module's
explicit Drizzle column map.

The execution context must contain the effective permission codes after user
overrides, current User and Organization, Organization descendants, role context,
and the Super Administrator flag. Never pass raw SQL or a Drizzle expression through
a permission rule or custom operator. Missing grants, handlers, context, or column
mappings deny access.

Role data-permission updates accept only version 1 rule documents. Multiple allow
and deny records may exist for one role/permission; the compiler performs allow
union minus deny union. `modules:check` verifies that resource permissions are
declared with type `data`, referenced fields exist, custom operator codes are owned
by the module, and API runtime operator registration is bidirectional.

## Executable Field Permissions

Field contributions and role field rules use the scenarios `list`, `detail`,
`create`, and `edit`. Business API declarations use `resourceAccess` to identify
their request and/or response resource scenario. Before returning records, call
`filterResponseFields`; before create/edit persistence, call
`assertWritableFields`. The API error boundary maps rejected writes to
`PERMISSION_FIELD_DENIED` (HTTP 403).

Frontend module pages use the field-permission helpers under
`apps/web/src/features/permissions`. Backend filtering and write rejection remain
mandatory; frontend hiding is only the matching user experience.

## Module Migrations

Register a `BusinessModuleMigrationSource` with separate SQLite and PostgreSQL directories. Each directory uses matching logical filenames:

```text
0001_create_records.sql
0002_add_record_status.sql
```

Base migrations execute first. Module sources sort by `moduleCode`, then local sequence. History IDs use `module:<moduleCode>:<logicalId>`, and SHA-256 checksums enforce append-only files. Generated artifacts include IDs and checksums, never SQL.

Do not edit an applied migration. Add a new sequence. Ordinary migration commands never drop a database and reject the pre-Phase-1 legacy history shape with an explicit rebuild instruction.

## Conformance Workflow

Run before requesting review:

```bash
pnpm modules:check
pnpm typecheck
pnpm test
pnpm build
```

`pnpm modules:check` prints human-readable errors and writes `.tmp/business-module-conformance.json`. It runs from `pnpm build`, `pnpm verify`, and the normal Verify workflow. Checks are deterministic and require no database or external integration.

The generated artifact at `packages/contracts/generated/base-system-manifests.json` contains the trusted Base System compatibility catalog, normalized module declarations, ownership, definition/activation hashes, and migration metadata. The directory is generated and ignored by Git.

## Registry Lifecycle And Admin Sync

Normal API and Worker startup read accepted state but never accept a changed release. A new, reintroduced, or activation-changed module remains pending. Presentation-only drift remains active while still appearing in the review plan.

Administrators with `module-registry:view` review the release catalog and immutable plan at `/system/modules`. Users with `module-registry:sync` may apply that plan after confirmation. Apply submits the reviewed `registryHash`, rejects stale releases, validates enabled dictionary dependencies, synchronizes metadata transactionally, removes obsolete authorization bindings, invalidates permission contexts, and writes Operation and Security Logs.

The database-backed CLI is read-only by default:

```bash
pnpm modules:sync
pnpm modules:sync --apply --expected-registry-hash=<sha256> --confirmed
```

Fresh initialization and `pnpm seed` validate dependencies and accept the complete compiled registry because no prior administrator decision exists. Existing manifest sync endpoints delegate through the same complete metadata transaction. Removing a module disables its metadata and authorization bindings while retaining its registry history, migrations, tables, and data.

Manifest Localized Messages persist `default_message` separately from `override_value`. A release can update the default without replacing an administrator override; setting the override to `null` restores the current manifest default. Removed module messages remain stored with disabled status.

## Test Isolation

Synthetic modules must live under a `test/fixtures` directory. They may be used to test valid definitions, invalid namespaces, broken references, runtime mismatch, Hono RPC inference, migration parity, and checksum enforcement.

Fixture module codes must never appear in production definitions, API/Web/Worker/database registries, Base menus, seed data, OpenAPI, generated production module catalogs, or mounted production routes. The repository includes a leakage test and bidirectional conformance checks for this boundary.

## Current Phase Boundary

Phases 1-3 are available. Phase 4 Base capability ports are not yet implemented; do not bypass that missing contract inside a module. Its status is tracked in `docs/known_gaps.md`.
