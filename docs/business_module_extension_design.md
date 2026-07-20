# Business Module Extension Design

This document records the confirmed design for a future implementation goal. It defines extension infrastructure only and must not introduce an example business module.

## Registration Model

- Business Modules use explicit static registration. There is no directory discovery, dynamic package loading, runtime installation, or module-level enable switch.
- `BusinessModuleDefinition` is serializable and side-effect free. API, Web, Worker, and database runtime registrations remain separate and link through `moduleCode`.
- `businessModuleRegistry` is initially empty in production. Tests use synthetic fixtures that are never mounted in the running system.
- Business Modules may depend on Base System public contracts but not on other Business Modules. No dependency graph, version solver, or load ordering is supported.
- Existing Base System manifests retain their identifiers and are wrapped by one trusted compatibility definition.

## Identity And Ownership

- `moduleCode` is globally unique, immutable, and lower kebab-case.
- Route, menu, event, and job codes use `<moduleCode>.<local-code>`.
- Permission codes use `<moduleCode>.<resource>:<action>`.
- API operation codes use `api.<moduleCode>.<operation>`.
- Import/export resource types use `<moduleCode>:<resource>`.
- i18n keys use `modules.<moduleCode>.<key>`.
- A module may not declare or mutate identifiers owned by another module.
- Frontend paths use `/modules/<moduleCode>/...`; API paths use `/api/modules/<moduleCode>/...`.
- Business Module APIs are authenticated and permissioned. Public Business Module APIs are outside this contract.

## Definition Metadata

- Required metadata is `contractVersion: 1`, `moduleCode`, `defaultLocale`, and a Localized Message title.
- Description is an optional Localized Message.
- Localized Messages contain a stable key and Default Message. A Single-Locale Business Module may provide only its default language; missing translations fall back to the Default Message.
- `defaultLocale` is a canonical BCP 47 language tag and is not limited to the Base System's currently selectable UI languages. A module cannot add a new language to the global language selector; that remains a Base System change.
- Magic prefixes and literal-only user-facing labels are prohibited.
- Module semantic versions, vendors, licenses, installation state, and package metadata are outside this contract. Modules version with the complete system release.

## Contributions

The normalized definition contains collections for permissions, APIs, routes, menus, data resources, field metadata, Operation Events, API log defaults, import/export resources, file attachment rules, Domain Events, Notification Events, i18n messages, dictionary dependencies, scheduled jobs, and module errors. Unused collections are empty.

Definitions contain only serializable declarations. Runtime handlers, Zod schemas, Hono routers, React pages, Drizzle mappings, Worker handlers, and authorization callbacks live in their owning runtime registrations.

## Conformance

- Declaration and runtime registration checks are bidirectional.
- API declarations must match mounted Hono routes.
- Frontend route declarations must match the TanStack generated route tree.
- Scheduled jobs and import/export resources must match Worker handlers.
- Protected API permissions, menus, routes, Localized Messages, and cross-references must resolve.
- Errors identify the module, contribution kind, identifier, and cause.
- `pnpm modules:check` performs deterministic checks without a database or external service, emits human-readable and JSON reports, and runs before build and normal CI verification.
- Environment-dependent dictionary and persistence checks belong to Module Sync Plan or integration tests.

## API And Frontend Composition

- API modules export typed Hono routers and are composed through an explicit `.route()` chain so the final `ApiApp` preserves Hono RPC inference.
- Zod request and response schemas are shared by runtime validation and OpenAPI generation. Missing explicit schemas are conformance failures.
- Frontend modules use explicit TanStack file routes under the module URL namespace and ordinary lazy React pages. Runtime route or component injection is not supported.
- Page, action, and field permission helpers are shared. Module query keys begin with `moduleCode` and are invalidated after Organization switching.
- Module component tests cover loading, empty, error, permission-denied, and mutation-error states.

## Module Sync

- A read-only Module Sync Plan compares the current registry with accepted database metadata and lists adds, updates, disables, dependency failures, and authorization bindings that will be removed.
- Apply requires administrator confirmation and `expectedRegistryHash`. A stale hash is rejected.
- Apply is idempotent and transactionally synchronizes module metadata, invalidates permission caches, and writes Operation and Security Logs.
- Existing manifest mutation APIs delegate to the same complete transaction for compatibility.
- Fresh initialization and seed apply the complete registry because no administrator exists yet. Normal startup never applies registry changes.
- `definitionHash` covers the complete declaration. `activationHash` covers SDK-classified security and runtime behavior. Modules cannot reclassify security fields as presentation fields.
- New or activation-changed modules remain pending until Apply. Unchanged modules remain active. Presentation-only drift does not suspend a module.
- Pending module APIs fail before authorization with `MODULE_NOT_SYNCHRONIZED`; their menus and Worker handlers remain inactive.
- Removal disables module metadata and active authorization bindings but never drops module tables or data. Reintroduction reuses migration history and requires new authorization. Module Codes cannot be reassigned.

## Database Migrations

- Modules statically register SQLite and PostgreSQL migration sources through the database package boundary.
- Base migrations run first. Module migrations run by `moduleCode` and local sequence.
- Migration history IDs use `module:<moduleCode>:<sequence>_<name>` and both dialects expose matching logical IDs.
- Migrations are append-only. Checksums detect modification of applied migrations. Down migrations and runtime automatic migration are not supported.
- This contract is introduced during internal development with no retained deployment database. Existing development SQLite and PostgreSQL databases are rebuilt; the migration runner does not carry a legacy checksum-baseline or history-table compatibility path.
- Normal migration commands never drop a database automatically. A legacy migration-history shape fails with a clear reset instruction.
- Generated artifacts contain migration IDs and checksums, never SQL.
- Module tables use `<module_code_with_underscores>__<local_table>` in both dialects. PostgreSQL-specific schemas are not used.
- Modules may reference Base System public entities but may not alter or drop Base System or other-module tables.
- Module removal retains tables, data, and migration history.

## Data And Field Permissions

- Each resource declares `accessModel: global | policy`. Global Resources do not accept data rules. Policy-Controlled Resources are fail-closed.
- Super Administrators retain all-data behavior. Other Users without a valid allow rule, handler, or context receive no records. Deny rules take precedence.
- Data rules use a versioned AST with `all`, `and`, `or`, and declared condition nodes. Administrators do not enter raw JSON, SQL, or source expressions.
- Base operators cover current User, current Organization, current Organization and descendants, specified Organizations, specified Users, and specified Roles.
- Module handlers may emit only neutral Predicate AST. Drizzle translation produces parameterized SQL at the database boundary.
- Multiple allow rules form a union; deny rules form a union removed from the allowed set.
- Field rules use `resource + field + scenario`, where scenario is `list`, `detail`, `create`, or `edit` and effect is `visible`, `hidden`, or `readonly`.
- Hidden fields are removed from responses and rejected in writes. Readonly fields remain visible but are rejected in writes. APIs declare request and response resource scenarios.
- Export fields are controlled by export permission and export configuration, not field-permission rules, as confirmed in `implementation_questions.md` item 27.

## Base Capability Ports

- Modules use explicit constructor injection and narrow public ports. They do not import Base System internal services, other-module repositories, or a global service locator.
- Public ports cover request/User/Organization context, permission evaluation, Operation Logging, Base File Service, import/export publication, notification publication, Outbox, clock, and ID serialization.
- Module repositories use the public database connection boundary.

## Persistence Invariants

- Module primary keys are auto-increment integers and API JSON serializes IDs as strings.
- Module tables retain nullable `tenant_id`, UTC audit timestamps, and soft-delete fields where lifecycle deletion applies.
- Organization-scoped resources store `organization_id` and use the Base System writable-Organization guard.
- Disabled or deleted Organizations reject new writes while retained historical records remain queryable under effective data rules.
- Global Resources explicitly declare the global access model.
- Shared conformance tests verify schema and repository behavior.

## Operation Logs And Errors

- Every non-GET Business Module API references a namespaced Operation Event. Security-sensitive reads may opt in.
- Middleware records success or failure, actor, current Organization, request/trace ID, target summary, and masked details. API call logging remains a separate concern with a required per-API log level.
- Worker operations use the same Operation Event catalog.
- Business errors use `BUSINESS_<MODULE_CODE_UPPER_SNAKE>_<LOCAL_CODE>`, declare HTTP status, Localized Message, and safe details schema, and are created through a typed factory.
- Base authentication, authorization, validation, system, and third-party errors remain reusable. Raw exceptions and sensitive details are never returned.

## Files

- Attachment declarations include a namespaced attachment code, resource, single/multiple mode, an extension subset of the Base System whitelist, and a size limit no larger than the system limit.
- Runtime registration authorizes view, attach, and detach for a concrete resource ID.
- Attachments use the Base File Service and durable File References. A private download requires global file permission or an authorized active reference before local content or an S3 signed URL is returned.
- Deleting a business record invalidates its references but does not automatically delete a Managed File that may have other references. Deleted files remain visible as invalid references.

## Import And Export

- Modules declare namespaced CSV resources, Localized Message columns, data types, required input, and explicit export field allowlists.
- API runtime registration handles filters, preview validation, and task creation. Worker registration performs import/export work. All declared handlers must match.
- Imports show the first configured errors, retain a complete error report, and revalidate before writes.
- Exports are asynchronous, prevent CSV formula injection, create no completion Notification, and retain result files for 30 days.
- Excel and module-specific task tables remain outside this contract.

## Events And Notifications

- Domain Events are recipient-free facts eligible for the controlled Webhook event catalog.
- Notification Events target Base System User IDs through a runtime recipient resolver and declare allowed in-app, email, or Webhook channels, template codes, and strict variable schemas.
- Events are namespaced, idempotent, and published through the transactional Outbox when coupled to database changes.
- Workers reuse existing in-app Notification, reliable Email Delivery, and Webhook Delivery aggregates.
- Arbitrary addresses, SMS, a public generic send API, and bypassing delivery aggregates are prohibited.

## Scheduled Jobs

- Modules declare namespaced job types, Localized Messages, parameter schemas, per-server or singleton execution, and retry/timeout boundaries.
- Administrators create schedules only for registered job types. Module registration does not seed Cron schedules.
- Worker handlers are designed for repeated execution. Singleton handlers use LockAdapter.
- Module removal disables its schedules and retains execution logs. Modules do not create private scheduling loops.

## i18n And Dictionaries

- Manifest i18n records retain a default message separately from an administrator override.
- Sync changes default text without overwriting an active administrator override. Administrators may restore the manifest default.
- Removed module messages are disabled but retained. Missing current-language text falls back to the Default Message.
- Dictionary dependencies reference enabled global dictionary type codes. Sync is blocked when a dependency is absent or disabled.
- Module sync does not create dictionary types or items, and item-level dependency declarations are not supported.

## Observability

- Module APIs inherit request/trace IDs and structured access/API logs.
- Module logs include module and operation/event codes while excluding tokens, secrets, signed URLs, and unmasked payloads.
- Outbox, Queue, and Worker messages propagate correlation, actor, and Organization context.
- Terminal Worker failures use the existing Alert port.
- Custom metrics DSLs, tracing vendors, and module-specific rate-limit languages are outside this contract.

## Management Surface

- `/system/modules` displays the release registry, registry and accepted hashes, module state, contribution counts, dependency status, drift, and Module Sync Plan.
- Base permissions `module-registry:view` and `module-registry:sync` control access and Apply.
- APIs are `GET /api/modules/registry`, `POST /api/modules/sync/plan`, and `POST /api/modules/sync/apply`.
- This surface manages accepted release metadata only. It is not a plugin marketplace or runtime installer.

## Test Isolation

- Synthetic Business Module fixtures live only under test fixture directories.
- Tests must prove that fixture module codes never appear in the production registry, generated production manifests, OpenAPI document, menus, seed data, or mounted runtime routes.
- Coverage includes valid and invalid definitions, ownership and cross-reference errors, Hono RPC inference, TanStack route alignment, API and Worker parity, fail-closed permissions, migration parity and checksums, Module Sync rollback and stale-hash rejection, per-module activation, i18n overrides, file authorization, asynchronous context propagation, and management-page states.
- PostgreSQL integration uses `TEST_DATABASE_URL`; SQLite remains covered by migration smoke tests.

## Delivery Sequence

The confirmed design is implemented through four reviewable goals:

1. Registry and Conformance Foundation: Definition contracts, `packages/module-sdk`, explicit empty production registries, Base System compatibility definition, namespace/cross-reference checks, generated artifacts, `pnpm modules:check`, and module migration sources/checksums.
2. Registry Lifecycle and Admin Sync: accepted state, dual hashes, plan/apply transaction, initialization behavior, per-module activation gates, i18n default/override persistence, APIs, CLI, and `/system/modules`.
3. Executable Data and Field Permissions: versioned DSL, operator handlers, neutral predicates, Drizzle translation, response/write field enforcement, frontend helpers, and fail-closed tests.
4. Capability Ports: Operation Events, typed errors, file attachment authorization, CSV resources, Domain/Notification Events, scheduled jobs, async context propagation, and their conformance tests.

The complete PRD extension acceptance criteria remain incomplete until all four goals are implemented. No phase may introduce an example business module.

## Implementation Status

- Phase 1 Registry and Conformance Foundation: implemented.
- Phase 2 Registry Lifecycle and Admin Sync: implemented.
- Phase 3 Executable Data and Field Permissions: implemented.
- Phase 4 Capability Ports: not implemented.
