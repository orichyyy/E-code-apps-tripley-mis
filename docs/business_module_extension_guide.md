# Business Module Extension Guide

No example Business Module is implemented in the Base System. The production registries intentionally contain zero modules.

The authoritative architecture is recorded in ADRs 0005-0007 and `docs/business_module_extension_design.md`. Registry/conformance, lifecycle/Admin Sync, executable permissions, and Capability Ports are implemented.

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

## Capability Runtime

API composition receives `BusinessModuleCapabilityFactory` through explicit dependencies. Create one scoped runtime from the accepted definition, matching API registration, and current `ModuleExecutionContext`. Do not import Base System repositories/services or expose a global capability lookup.

The execution context always identifies the module, source (`api` or `worker`), actor, current Organization, session, request, trace, correlation, and locale. Queue, Outbox, CSV, and job messages preserve that context and add message and idempotency identities. Worker handlers receive the reconstructed context plus an `AbortSignal`.

Capability calls fail closed when their declaration, schema, runtime handler, authorization context, or active module registration is missing.

## Operations And Errors

Every non-GET API declaration references a declared Operation Event. Record success and failure through `capabilities.operations`; declared sensitive detail fields are masked before asynchronous queue publication. Worker operations use the same catalog. If Queue publication fails, the API writes a local JSONL fallback record containing the safe event and propagated context.

Create module errors through `capabilities.errors`. Error codes must use `BUSINESS_<MODULE_CODE_UPPER_SNAKE>_<LOCAL_CODE>`, and optional details are parsed by the registered Zod schema before the Hono error boundary serializes them. Raw exceptions and undeclared details are not part of the public contract.

## Managed Files

Declare each attachment's resource, cardinality, allowed extension subset, and size limit. Register `canView`, `canAttach`, and `canDetach` authorizers in the API registration. Use `capabilities.files` so the Base File Service remains responsible for file state and durable `file_references`.

Private download and preview first evaluate the global file permission. Without that permission, the API requires an active module, active matching reference, declared attachment, and successful module `canView` result before returning local content or signing an S3 URL. Deleting a business record invalidates its references; it does not directly delete shared Managed File content.

## CSV Import And Export

CSV resources declare explicit columns, import/export capabilities, and export field allowlists. API registrations normalize export filters and perform import preview validation. Worker registrations implement only the declared import/export handlers.

`capabilities.csv` creates idempotent Base System tasks and publishes asynchronous work. The Worker rereads Managed File content through its recorded storage driver, rejects undeclared/required-column violations, escapes spreadsheet formula prefixes, stores complete error reports, limits the inline preview, and retains result files for 30 days. Export completion does not send a Notification.

## Events And Notifications

Publish recipient-free facts through `capabilities.domainEvents`. Publish directed intents through `capabilities.notifications`; the registered resolver returns Base System User IDs, and only declared channels and template codes are accepted. Arbitrary email addresses, phone numbers, Webhook URLs, and direct transport drivers are prohibited.

Both event types are idempotent and use the database Outbox when coupled to persisted work. In-app and email requests reuse their existing durable aggregates. Webhook-eligible Domain and Notification Events enter the controlled event catalog only while their module is active, then reuse durable Webhook fan-out, signing, retries, and delivery history.

## Background And Scheduled Jobs

Use `capabilities.jobs.enqueue` for declared job types. Payloads are parsed with the registered Zod schema, timeout/retry values cannot exceed declaration maxima, and Queue messages retain the Module Execution Context. Worker registration is bidirectional and only active accepted modules are loaded.

Per-server handlers execute independently. Singleton handlers acquire `LockAdapter`; no lock means that polling cycle performs no duplicate work. Administrators can persist, enable, or immediately run only Base System or active-module handler types. Module removal disables retained schedules and does not delete execution history. Module registration never seeds Cron schedules.

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

## Current Boundary

All four extension-foundation phases are available. Production registries intentionally remain empty, so adding the first production Business Module still requires explicit definition/API/Web/Worker/database registration, Module Sync review, module-owned tests, and a separate business requirement. Do not add runtime discovery, direct Base System internals, arbitrary delivery targets, private scheduling loops, or cross-module dependencies.
