# Implementation Questions

## Confirmed Backend Core Decisions

1. **Concrete SQLite driver for local/demo migrations**

   Confirmed: v1 local development, testing, and demo migrations use `better-sqlite3` behind the database package connection boundary.

2. **PostgreSQL integration test database source**

   Confirmed: PostgreSQL integration tests use an externally provided `TEST_DATABASE_URL`. Explicit PostgreSQL migration execution may also use `DATABASE_URL`.

3. **SQLite int64 materialized-path JavaScript mapping**

   Confirmed: the `better-sqlite3` driver boundary enables safe integer reads so organization `path` values round-trip as `bigint` when raw driver access is used. DB-backed repositories must preserve this boundary when they are introduced.

4. **CSRF strategy for refresh/logout cookie endpoints**

   Confirmed: v1 uses a double-submit cookie strategy. Login issues a non-HttpOnly `csrf_token` cookie alongside the HttpOnly `refresh_token`; refresh and logout require the same token in the `x-csrf-token` header. The cookie uses SameSite Strict by default and follows the configured refresh-cookie path/secure/domain settings.

5. **Canonical login session table shape**

   Confirmed: v1 keeps the PRD `auth_sessions` table name and existing fields, plus the already implemented token-version and status fields.

6. **Permission tree hierarchy model**

   Confirmed: v1 derives a virtual permission tree from flat permission metadata (`module`, `resource`, `action`, `permission_type`). No `parent_id` is added to the permissions table.

7. **Role data/field permission persistence model**

   Confirmed: role data permissions use a `role_data_permissions` binding table. Role field permissions use `field_permission_rules` with `target_type = 'role'` and `target_id = role_id`.

8. **User permission override persistence and precedence**

   Confirmed: v1 user overrides use `permission_id` with `allow`/`deny` effects. User overrides have higher priority than role grants.

9. **Default initialization records for system configuration, dictionaries, and i18n**

   Confirmed: seed only confirmed base system configuration, dictionary, and i18n data. Do not invent default records whose canonical keys and values are not specified.

   Implemented handling: system configuration, dictionary, and i18n schema/API support is implemented without adding unconfirmed default seed records.

## Backend Core Foundation Blockers

No unresolved backend-core blockers remain from the previously listed questions. Role data permissions, role field permissions, and user permission overrides now have service-level APIs and effective-permission behavior; remaining gaps are tracked in `docs/known_gaps.md`.

## Backend Infrastructure Modules Blockers

10. **Executable database-backed infrastructure depends on durable repository scope**

    Confirmed: implement durable PostgreSQL infrastructure repositories and tests first. SQLite must remain migration-executable and usable for local/demo compatibility, but PostgreSQL is the tested durable deployment target.

11. **SQLite local/demo database-backed infrastructure boundary**

    Confirmed: SQLite infrastructure migrations should remain executable for local/demo compatibility. Runtime durable database adapters may be implemented behind the shared database boundary, with PostgreSQL as the required integration-test target.

12. **Database LockAdapter concrete algorithm**

    Confirmed: v1 database locks use a lease table, not PostgreSQL advisory locks. The table records lock key, owner, fencing token, expiration time, and heartbeat time. Acquisition succeeds only when no unexpired lease exists or the existing lease has expired.

13. **RabbitMQ driver package and delivery semantics**

    Confirmed: v1 keeps RabbitMQ as an optional interface/driver placeholder and does not add a RabbitMQ package or mandatory dependency until package/configuration/delivery semantics are separately confirmed.

14. **Optional Redis dependency strategy**

    Confirmed: v1 keeps Redis as optional dynamic-import/interface placeholders and does not add a mandatory Redis dependency.

15. **S3-compatible storage client and configuration contract**

    Confirmed: v1 keeps local filesystem storage as the runnable default and implements optional S3-compatible storage with AWS SDK v3. Production buckets must be provisioned outside the application; explicit development/test configuration may enable automatic bucket creation. Buckets remain private, and authenticated S3-backed downloads use a 60-second presigned URL. The API and worker share validated `FILE_STORAGE_DRIVER` and `S3_*` configuration, support either complete explicit credentials or the AWS SDK default credential chain, and constrain the configurable presigned URL lifetime to 15-900 seconds with a 60-second default. The pinned official `rustfs/rustfs:1.0.0-beta.8` image is the optional Docker-backed S3 compatibility test environment; RustFS-specific APIs are prohibited, and no production object-storage provider is selected by this decision.

16. **SMTP and webhook delivery semantics**

    Confirmed: v1 implements notification channel interfaces and durable notification records. SMTP email sending uses an optional configuration-driven driver over Node.js built-ins and remains disabled unless `SMTP_ENABLED=true` with host/from configuration. Webhook/in-memory behavior may be represented as placeholders.

    Implemented handling: SMTP template test sending remains optional. Webhook subscription management and reliable outbound delivery are now implemented under the later, more specific decision in item 22; delivery remains disabled unless explicitly configured and adds no mandatory external broker dependency.

17. **Infrastructure table scope for adapter persistence**

    Confirmed: v1 introduces minimal durable adapter tables named `cache_entries`, `rate_limit_counters`, `locks`, `queue_jobs`, `event_outbox`, and `scheduled_jobs`, plus durable base-module tables for logs, files, notifications, and import/export tasks as needed by implemented modules.

18. **Import/export resource scope in the infrastructure goal**

    Confirmed: v1 implements the generic CSV framework/task model only. It must not implement example business modules. Existing base-system log export may use the generic CSV export path.

19. **Scheduled task retry behavior versus reserved queue retry/dead-letter behavior**

    Confirmed: v1 queue/job retry uses `attempt`, `max_attempts`, and `next_run_at`. Dead-letter behavior remains reserved and is represented only by status/fields, without a complex DLQ implementation.

20. **Notification template seed records**

    Confirmed: v1 adds schemas/APIs for multilingual notification templates but does not seed unconfirmed default template content. SMS templates remain reserved.

21. **Announcement organization scope reference**

    Confirmed: organization-scoped Announcements use one or more explicit Organization targets. Each target includes its Organization subtree, targets must form a distinct minimal set, and visibility is calculated dynamically against the User's current Organization. System Announcements have no targets. The complete contract is recorded in `docs/announcement_targeting_design.md` and ADR 0004.

22. **Reliable outbound Webhook delivery semantics**

    Confirmed: outbound Webhooks use a controlled initial event catalog, CloudEvents-compatible structured JSON, transactional database Outbox fan-out, durable delivery and attempt records, bounded at-least-once retries, HMAC-SHA256 request signatures, encrypted subscription secrets, strict SSRF controls, and a deployment-level feature switch that is disabled by default. Database state remains authoritative when RabbitMQ is enabled. The complete confirmed contract is recorded in `docs/webhook_delivery_design.md` and ADR 0002.

23. **Webhook subscription deletion API conflict**

    Confirmed: the PRD includes `DELETE /api/webhooks/:id` while the design specification omits it. The implementation will follow the PRD and add soft deletion with a dedicated `webhook:delete` permission, cancel pending deliveries for the deleted subscription revision, and retain historical delivery records through their normal retention period.

24. **Permission manifest sync Webhook event target**

    Confirmed: add `targetType = 'system'` and `changeType = 'manifestSync'`. A permission manifest synchronization that changes persisted state emits one summary event with `targetId = 'permission-manifest'` and `organizationId = null`.

25. **Reliable SMTP email delivery semantics**

    Confirmed: internal email requests target one enabled User, require a caller-provided idempotency key, use an exact-language immutable Email Template identity, validate a strict primitive variable contract, and snapshot rendered content before persistence. Email Delivery is the sole durable claim/retry authority and remains separate from the generic queue, event Outbox, and in-app Notification lifecycle.

    Confirmed security and lifecycle handling: content snapshots use a dedicated versioned AES-256-GCM keyring, terminal states purge content immediately, remote SMTP requires implicit TLS or STARTTLS, attempts are at least once with a stable Message ID, retryable failures are bounded, and safe metadata remains for configurable retention. Reliable delivery and SMTP transport use separate optional switches. The complete contract is recorded in `docs/email_delivery_design.md` and ADR 0003.

    Confirmed key-failure handling: missing historical content keys leave affected work pending without consuming attempts and degrade Worker health; authenticated decryption failure with a configured key is a final corruption failure. Old keys may be removed only after rotation proves no unfinished Delivery references them.

26. **Announcement lifecycle and API boundary**

    Confirmed: only drafts may be edited or soft deleted; publication is immediate; published Announcements must be withdrawn before edit/delete; optional UTC expiration is evaluated at read time without a scheduler. The management Catalog remains separate from authenticated Current Announcements, and publication does not trigger Notification, email, SMS, or Webhook delivery. Add the PRD-confirmed delete endpoint and `announcement:delete` permission despite its omission from the design route table.

27. **Business-module export fields versus field permissions**

    Confirmed: follow the more specific Version 1 boundary in design specification section 12.8. Export fields are controlled by the module's export permission and export configuration, not by role field-permission rules. Field-permission scenarios remain list, detail, create, and edit. This decision resolves the conflicting acceptance statement in PRD section 26.4; module export declarations and tests must prove that only explicitly configured export fields are emitted.

28. **Business Module extension architecture and delivery sequence**

    Confirmed: use the explicit static, namespaced registry in ADR 0005 and `docs/business_module_extension_design.md`. Definitions are serializable; API, Web, Worker, and database implementations register separately and are checked bidirectionally. Runtime plugin discovery, public Business Module APIs, cross-Business-Module dependencies, automatic migrations, and example modules are excluded.

    Confirmed delivery: implement the design as four goals: Registry and Conformance Foundation; Registry Lifecycle and Admin Sync; Executable Data and Field Permissions; and Capability Ports. All four phases are implemented. Production registries remain empty, so this completes the extension foundation without claiming that a production Business Module exists.

29. **Migration checksum adoption for existing development databases**

    Confirmed: no compatibility baseline is required. The project is still in internal development and has no retained deployment database, so existing SQLite and PostgreSQL development/test databases will be rebuilt when the module-aware migration history is introduced. Do not add permanent legacy-history backfill code. Normal migration commands must remain non-destructive and fail with a clear reset instruction when they encounter the old history shape.
