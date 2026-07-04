# Known Gaps

This file records incomplete, reserved, or environment-dependent work that must not be claimed complete.

## Validation Prerequisites

- PostgreSQL migrations and PostgreSQL integration tests require `TEST_DATABASE_URL` or `DATABASE_URL`.
- PostgreSQL tests are skipped in local runs when `TEST_DATABASE_URL` is absent.
- SQLite local/demo coverage uses the confirmed `better-sqlite3` driver and remains executable through the migration and adapter smoke paths.

## Implemented With Explicit Boundaries

- DB-backed backend-core persistence is implemented behind `BACKEND_CORE_STORE=database`; a whole-store snapshot helper remains only for test reset and full-store support utilities.
- Announcement organization scoping stores the confirmed `scope_type` value. A concrete organization target/reference field is not implemented because the base contract has not confirmed it.
- In-app notification dispatch exists through queue-backed internal services and worker execution. A public administrator create-notification API and frontend create flow are not exposed because no base API contract confirms them.
- i18n message management supports editing existing persisted messages. New i18n key creation remains manifest/module-driven rather than an ad hoc frontend create flow.
- File management supports local-storage upload, metadata, authenticated download, image preview, references, and delete-invalidate behavior. S3-compatible storage configuration UI and concrete S3 driver wiring remain reserved.
- SMTP email has an optional configuration-driven driver and test-send API. Production delivery retry workflows remain reserved.
- Worker task registration includes the confirmed base-system task catalog. Future business-module task catalogs are outside the base system.

## Reserved Optional Integrations

- Redis cache/rate-limit drivers remain optional placeholders only.
- RabbitMQ queue/event-bus drivers remain optional placeholders only.
- S3-compatible file storage remains reserved until its concrete package and runtime configuration contract are confirmed.
- SMS notification sending remains reserved; SMS templates/interfaces may exist, but no sender is implemented.
- Real outbound webhook delivery and external webhook retry workers remain reserved. Webhook subscription persistence and management APIs/UI are implemented.
- A separate dead-letter queue implementation remains reserved. Database queue jobs currently use the existing `dead_letter` status when attempts are exhausted.

## Documentation and Schema Coverage Debt

- OpenAPI request/response schemas are explicit for newer permission-extension, infrastructure, system-management, communication, file, profile, and SMTP test-send APIs. Some older backend-core endpoints still use the generic success envelope unless they have already been mapped.
- Documentation should continue to distinguish optional integrations from completed default runtime behavior when new drivers are added.
