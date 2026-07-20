# Known Gaps

This file records incomplete, reserved, or environment-dependent work that must not be claimed complete.

## Validation Prerequisites

- PostgreSQL migrations and PostgreSQL integration tests require `TEST_DATABASE_URL` or `DATABASE_URL`.
- PostgreSQL tests are skipped in local runs when `TEST_DATABASE_URL` is absent.
- SQLite local/demo coverage uses the confirmed `better-sqlite3` driver and remains executable through the migration and adapter smoke paths.

## Implemented With Explicit Boundaries

- DB-backed backend-core persistence is implemented behind `BACKEND_CORE_STORE=database`; a whole-store snapshot helper remains only for test reset and full-store support utilities.
- Announcement organization targeting, lifecycle enforcement, and dynamic current-Organization visibility are implemented. Announcement publication intentionally does not create recipient snapshots, read state, in-app Notifications, email, SMS, or Webhook delivery.
- In-app notification dispatch exists through queue-backed internal services and worker execution. A public administrator create-notification API and frontend create flow are not exposed because no base API contract confirms them.
- i18n message management supports administrator overrides and restoring manifest defaults for existing persisted messages. New i18n key creation remains manifest/module-driven rather than an ad hoc frontend create flow.
- File management supports coexisting local/S3 object locations, authenticated local responses, private S3 presigned redirects, upload compensation, and asynchronous physical Content Deletion. Local remains the default.
- Reliable email delivery is implemented as an optional encrypted Email Delivery aggregate with internal idempotent requests, Worker claims/retries, terminal content purge, read-only APIs/UI, STARTTLS enforcement, key rotation tooling, and Mailpit compatibility coverage. It remains disabled by default. Production SMTP provider selection, key custody, and target-environment acceptance remain pending.
- Worker task registration includes the confirmed base-system task catalog. Future business-module task catalogs are outside the base system.
- Outbound Webhook delivery is implemented with a controlled event catalog, transactional Outbox, durable attempts, bounded retries, secret encryption, HMAC signing, SSRF controls, retention cleanup, management APIs, and frontend history. It remains disabled unless `WEBHOOK_DELIVERY_ENABLED=true` is configured for both API and Worker.

## Business Module Extension Gap

- Phase 1 is complete: serializable definitions, `packages/module-sdk`, deterministic definition/activation hashes, explicit empty production registries, Base System compatibility metadata, bidirectional conformance, generated artifacts, and checksummed SQLite/PostgreSQL module migration sources are implemented.
- Phase 2 is complete: accepted registry persistence, dual-hash Module Sync plan/apply, stale-hash and dependency rejection, administrator confirmation, initialization/seed bootstrap, API/menu/runtime activation boundaries, i18n default/override persistence, CLI support, audit logs, and the `/system/modules` APIs/UI are implemented.
- Phase 3 is complete: strict versioned data rules, base/custom operator compilation, fail-closed neutral predicates, parameterized Drizzle translation, effective-grant and user-override handling, scenario-aware response/write field enforcement, runtime declaration checks, frontend helpers, and SQLite/PostgreSQL execution coverage are implemented.
- Phase 4 remains incomplete: capability ports and executable module integration for operation events, typed errors, file attachments, CSV resources, events/notifications, scheduled jobs, and asynchronous context propagation are not implemented.
- Production Business Module registries intentionally contain zero modules. Synthetic fixtures remain under test fixture directories and must never enter production manifests, OpenAPI, menus, seeds, or mounted routes.

## Reserved Optional Integrations

- Redis cache/rate-limit drivers are implemented as optional adapter drivers and covered by Docker-backed integration tests when `REDIS_URL` is provided. They are not required for default local, CI, or deployment validation.
- RabbitMQ queue/event-bus drivers are implemented as optional adapter drivers and covered by Docker-backed integration tests when `RABBITMQ_URL` is provided. API and worker queue runtime selection can opt in with `QUEUE_DRIVER=rabbitmq`; worker execution still keeps the database durable queue/scheduler active for existing database-backed scheduled and import/export tasks.
- The generic S3-compatible driver is implemented and covered by the optional pinned RustFS compatibility suite. RustFS is test-only; production object-storage provider selection and target-environment deployment acceptance remain pending.
- SMS notification sending remains reserved; SMS templates/interfaces may exist, but no sender is implemented.
- Reliable email intentionally has no public create API, manual retry/cancel/export, HTML/attachments, bounce tracking, inbox-delivery claim, separate DLQ, or default business templates. These remain outside the confirmed v1 contract.
- Webhook manual replay/cancellation/export, custom request headers, a public arbitrary-notification API, and automatic subscription disabling after failures remain outside the confirmed v1 contract.
- A separate dead-letter queue implementation remains reserved. Database queue jobs currently use the existing `dead_letter` status when attempts are exhausted.

## Reliable Outbound Webhook Delivery Progress

- Implemented controlled events, transactional Outbox writes, directed notification publication, durable fan-out/deliveries/attempts, bounded retries, stale-running recovery, per-subscription concurrency, and database-locked retention cleanup.
- Implemented encrypted/rotatable subscription secrets, request HMAC signatures, HTTPS and SSRF protections, DNS address pinning, redirect rejection, safe logs, and final-failure alert integration through a no-op default.
- Implemented subscription revision cancellation/deletion, event catalog and delivery history APIs, OpenAPI/Hono RPC coverage, and frontend subscription/delivery tabs with safe details.
- Default local, CI, and deployment paths keep delivery disabled. Production destination allowlisting, receiver ownership, key custody, and target-environment acceptance remain pending until that environment is ready.

## Schema Boundaries

- OpenAPI response schemas are now mapped for backend-core, permission-extension, infrastructure, system-management, communication, file, profile, and SMTP test-send APIs. Infrastructure response item schemas now expose concrete fields; flexible `metadata`, `payload`, `errorPreview`, and template-variable maps remain open objects by design.
