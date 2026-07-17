# Reliable Email Notification Delivery

## Problem Statement

The Web Admin Base System can manage multilingual notification templates and can synchronously test an optional SMTP connection, but it cannot yet accept, persist, retry, inspect, or safely operate real email notification work. A process failure or temporary SMTP error can lose a send, while direct retries can duplicate it. Operators cannot inspect delivery outcomes without exposing sensitive recipient or message content, and the current plaintext SMTP path does not enforce STARTTLS for remote servers.

The system needs a reliable, optional email-delivery foundation that future base-system and business-module workflows can call without adding an arbitrary public email API or making SMTP, encryption keys, Docker, or a production mail provider mandatory for default development and CI.

## Solution

Add an internal Email Notification Request service that creates one idempotent, encrypted Email Delivery for one enabled User from one exact-language Email Template. The Email Delivery aggregate becomes the sole persistence, Worker claim, retry, recovery, and history authority. A separate Email Delivery Attempt records each SMTP operation without storing sensitive content.

The Worker sends the fixed Email Content Snapshot through the existing Notification Channel Adapter, with implicit TLS or STARTTLS for remote SMTP, a stable Email Message ID, bounded at-least-once retry, stale-work recovery, final-failure alerts, and immediate terminal content purge. Administrators receive a read-only bilingual delivery-history page and safe APIs. A development-only request CLI and optional pinned Mailpit environment provide end-to-end acceptance without exposing a production HTTP creation route.

## User Stories

1. As an internal system workflow, I want to request one template-based email for one User, so that I can notify that User without knowing SMTP details.
2. As an internal system workflow, I want to provide an Email Request Key, so that retrying my request does not create duplicate email work.
3. As an internal system workflow, I want an idempotent replay with the same semantic input to return the existing Email Delivery, so that caller recovery is predictable.
4. As an internal system workflow, I want reuse of an Email Request Key with different semantic input to fail explicitly, so that accidental key collisions do not send incorrect content.
5. As a User, I want email content rendered using my Effective Language, so that I receive the intended localized notification.
6. As a User, I want email template locale matching to be exact, so that I do not receive an unintended fallback language.
7. As a User, I want my email address and selected language fixed when the request is accepted, so that retries do not change recipient or language unexpectedly.
8. As a User, I want later template edits not to alter an already accepted Email Delivery, so that repeated attempts remain consistent.
9. As a User, I want a new request rejected when my account is disabled, locked, deleted, or has no valid email address, so that the system does not create unauthorized work.
10. As a User, I want an accepted Delivery to continue if my account is later locked or disabled, so that already committed notifications remain deterministic.
11. As a deleted User, I want unfinished email work canceled, so that the system stops future sends after soft deletion.
12. As a template administrator, I want channel, code, and locale to identify one immutable Email Template, so that internal callers have a stable contract.
13. As a template administrator, I want the same code and locale to support separate in-app, email, and reserved SMS templates, so that channels do not conflict in persistence.
14. As a template administrator, I want every placeholder declared and every declaration used, so that invalid templates fail before they affect delivery.
15. As an internal system workflow, I want missing, extra, object, or array template variables rejected, so that rendering is deterministic and safe.
16. As an operator, I want reliable email acceptance disabled independently from SMTP transport, so that optional configuration remains explicit.
17. As an operator, I want to accept encrypted pending work while SMTP transport is temporarily disabled, so that a maintenance window does not lose requests.
18. As an operator, I want disabling reliable email acceptance to pause existing work and reject new work, so that I can stop the feature without deleting history.
19. As an operator, I want the Worker to recover stale running work, so that a crashed Worker does not permanently strand an Email Delivery.
20. As an operator, I want transient network, timeout, DNS, and SMTP `4xx` failures retried, so that temporary infrastructure problems do not lose notifications.
21. As an operator, I want SMTP `5xx`, TLS validation, missing STARTTLS, protocol, and configuration failures treated as final, so that permanent failures do not retry forever.
22. As an operator, I want five attempts by default with bounded delays, so that retry behavior is predictable and resource usage remains controlled.
23. As an operator, I want exhausted Deliveries to become failed and invoke AlertIntegration, so that terminal failures are visible without a separate DLQ.
24. As an operator, I want each Attempt to reuse one stable Email Message ID, so that downstream systems can detect at-least-once duplicates.
25. As an operator, I want SMTP Acceptance to be distinguished from inbox delivery, so that delivery status is not overstated.
26. As an operator, I want same-User Deliveries processed independently, so that one temporarily failing email does not block later notifications.
27. As a security administrator, I want recipient, subject, and body encrypted at rest, so that database access alone does not reveal message content.
28. As a security administrator, I want a dedicated email-content keyring, so that Webhook and email cryptographic domains remain isolated.
29. As a security administrator, I want terminal content purged immediately, so that sensitive data is retained only while required for sending.
30. As a security administrator, I want missing historical keys to pause affected work without consuming attempts, so that a deployment mistake does not destroy recoverable content.
31. As a security administrator, I want authenticated decryption corruption to fail and alert explicitly, so that damaged ciphertext is not silently ignored.
32. As a security administrator, I want key rotation to prove no unfinished Delivery references an old key, so that removing that key cannot strand pending work.
33. As a security administrator, I want remote SMTP to require implicit TLS or STARTTLS, so that credentials and message content are not sent over plaintext networks.
34. As a developer, I want explicitly permitted insecure SMTP only on loopback in development or test, so that local capture tools remain usable without weakening production.
35. As an operator, I want SMTP username and password configured together, so that incomplete authentication configuration fails early.
36. As a User, I want UTF-8 plain-text email with safely encoded headers, so that multilingual content works without header injection.
37. As an administrator, I want a read-only Email Delivery list, so that I can inspect operational outcomes.
38. As an administrator, I want to filter history by User, template code, locale, status, and time range, so that I can diagnose a specific delivery problem.
39. As an administrator, I want safe Attempt details with timing, SMTP code, and redacted error summaries, so that I can diagnose failures without viewing sensitive content.
40. As a security administrator, I want APIs and UI to hide raw recipient addresses, subject, body, variables, ciphertext, credentials, and full SMTP responses, so that management access does not expose message content.
41. As an authorization administrator, I want a dedicated email-delivery view permission, so that delivery history can be granted independently.
42. As an operator, I want terminal metadata retained for 90 days by default, so that recent operational history is available.
43. As an operator, I want retention configurable and protected by a distributed lock, so that multi-Worker cleanup is safe.
44. As an operator, I want pending and running work excluded from retention deletion, so that cleanup cannot lose active notifications.
45. As an operator, I want safe structured logs and final alerts, so that observability works without leaking recipient or content data.
46. As a template administrator, I want synchronous SMTP test sending to remain a diagnostic action, so that transport/template diagnosis does not create reliable-delivery history.
47. As a developer, I want a development/test-only Email Notification Request CLI, so that I can exercise the real internal service without adding a public HTTP endpoint.
48. As a developer, I want the CLI to require an existing User, template, request key, and variables, so that it does not seed example business data.
49. As a developer, I want an optional local Mailpit inbox, so that I can inspect a real accepted message during manual acceptance.
50. As a maintainer, I want normal tests and push CI independent of Mailpit and SMTP, so that optional infrastructure does not slow or destabilize verification.
51. As a maintainer, I want SQLite migrations to remain executable, so that local development and demo remain usable.
52. As a maintainer, I want PostgreSQL persistence and concurrent claims tested through `TEST_DATABASE_URL`, so that the supported deployment database has integration coverage.
53. As a frontend developer, I want internal API typing to remain Hono RPC-based, so that OpenAPI remains documentation rather than replacing the existing client boundary.
54. As a deployment operator, I want production SMTP provider selection and acceptance documented as pending, so that implementation completion is not confused with environment readiness.

## Implementation Decisions

- Follow ADR 0003 and the reliable email delivery design. Use the domain terms Email Notification Request, Email Request Key, Email Template, Email Content Snapshot, Email Delivery, Email Delivery Attempt, Email Message ID, Effective Language, and SMTP Acceptance consistently.
- Keep Node.js as the only backend runtime, SQLite usable for local/demo, and PostgreSQL as the tested deployment database. Do not add SQL Server support.
- Add dedicated SQLite and PostgreSQL schemas and migrations for Email Deliveries and Email Delivery Attempts. Use database auto-increment IDs, UTC timestamps, and string serialization for all API IDs.
- Make Email Delivery the only authoritative work state. Do not create generic queue jobs, event Outbox records, or in-app Notification rows for reliable email.
- Accept requests only through an internal application service. Each request targets one enabled, non-deleted User and includes request key, User ID, template code, strict primitive variables, and optional reference fields.
- Enforce idempotency with a unique request-key/User pair and a canonical SHA-256 semantic request fingerprint. Identical duplicates return existing state; mismatched duplicates return a dedicated conflict error.
- Resolve the User's Effective Language at creation and require an exact enabled email template. Do not add an email-specific fallback language.
- Change Notification Template uniqueness to channel, code, and locale. Make these identity fields immutable after creation; updates are limited to content, variable contract, and status.
- Validate template placeholders and declared variables as an exact set. Validate request variables as the same exact set and restrict values to string, number, boolean, or null.
- Render before persistence and store no original variable map. Snapshot recipient, locale, subject, body, template identity/update time, and stable Message ID.
- Encrypt recipient, subject, and body as a versioned AES-256-GCM envelope under a dedicated email keyring. Persist the content key ID separately for pre-claim availability checks.
- Require the reliable-delivery feature switch before accepting new work. Require a valid keyring when reliable delivery is enabled. Keep the feature disabled by default.
- Keep SMTP transport under its own optional switch. Reliable delivery enabled with SMTP disabled may accumulate encrypted pending work without consuming attempts.
- Extend shared API/Worker SMTP configuration with timeout and secure local-development controls. Require username/password together.
- Require implicit TLS when secure mode is selected. Otherwise require STARTTLS for remote SMTP, reissue EHLO after upgrade, and use default certificate/hostname validation.
- Allow plaintext SMTP only for explicitly enabled loopback destinations in development/test, and reject this exception in production.
- Keep message format UTF-8 plain text with one To recipient and deployment-defined From. Preserve safe MIME subject encoding and CR/LF header-injection prevention.
- Extend the SMTP transport boundary to return or throw typed, sanitized SMTP outcomes that distinguish response codes, retryability, security/configuration failures, and SMTP Acceptance without exposing full server text.
- Use Delivery states pending, running, succeeded, failed, and canceled. One Delivery may have at most one active Attempt. Different Deliveries, including those for the same User, may run concurrently with no ordering guarantee.
- Default global Worker concurrency to 4, configurable from 1 to 32. Use PostgreSQL skip-locked claims and retain SQLite single-Worker local behavior.
- Default maximum attempts to 5, configurable from 1 to 10. Retry after 30 seconds, 2 minutes, 10 minutes, and 30 minutes.
- Retry network, connection, DNS, timeout, and SMTP `4xx` failures. Treat SMTP `5xx`, authentication, TLS validation, missing STARTTLS, protocol, and local configuration failures as final.
- Reuse one stable Email Message ID for every Attempt. Document and expose at-least-once semantics; do not claim exactly-once or inbox delivery.
- Recover stale running work after a configurable 900-second default. Do not consume attempts while either feature or SMTP transport is paused.
- Leave work pending and degrade Worker health when its referenced key ID is absent. Do not create an Attempt. Treat authenticated decryption failure with a present key as final corruption.
- In the same transaction that records a terminal state, clear the encrypted envelope and record content purge time.
- Retain safe terminal Delivery/Attempt metadata for 90 days by default, configurable from 1 to 3650 days. Never delete pending/running work through retention. Protect cleanup with LockAdapter.
- Cancel unfinished work after User soft deletion. Later lock/disable changes do not alter already accepted work; email, language, and template edits never alter its snapshot.
- Invoke AlertIntegration on final failure and content corruption. Emit only IDs, template identity, masked recipient, safe code, attempt count, and timestamps.
- Add read-only authenticated list/detail APIs with explicit OpenAPI schemas and Hono RPC inference. Add permission `notification:email-delivery:view`.
- Add a bilingual frontend management page with filters, loading, empty, error, permission-denied, and safe detail states. Never expose content or cryptographic material.
- Keep the existing SMTP test-send route synchronous and outside reliable history. When SMTP is disabled, return a clear not-enabled error instead of in-memory success.
- Add a development/test-only request CLI using the same internal service. Reject production execution and do not seed Users, templates, or example modules.
- Add optional pinned Mailpit development tooling bound to localhost with an initial 128 MB memory limit, a dedicated integration command, and a manually triggered workflow. Keep it out of normal push Verify.
- Provide a scan-default, explicit-apply key migration command. Prevent operators from removing keys still referenced by pending/running work.
- Update environment examples, local/deployment/adapter/troubleshooting/acceptance documentation, status matrix, implementation plan, and known gaps. Keep production provider and target-environment acceptance pending.

## Testing Decisions

- Use one primary high-level integration seam: submit an internal Email Notification Request, persist it in PostgreSQL, run the Worker against a local SMTP/STARTTLS receiver, and query safe Delivery/Attempt history through the management API.
- Good tests assert external state transitions, SMTP-observable messages, API contracts, and non-disclosure. They must not assert private method calls or duplicate internal implementation structure.
- Follow the existing reliable Webhook PostgreSQL/Worker tests as prior art for idempotency, skip-locked claims, stale recovery, bounded retries, retention locking, safe Attempt history, and at-least-once behavior.
- Follow existing notification template and SMTP adapter tests as prior art for rendering and SMTP protocol behavior, while strengthening them for exact variables, typed errors, STARTTLS, stable Message IDs, and disabled transport behavior.
- Add contract tests for request/response schemas, permissions, OpenAPI mappings, error codes, and Hono RPC inference.
- Add pure boundary tests only where the primary seam cannot isolate behavior precisely: canonical request fingerprinting, placeholder/variable validation, AES-GCM envelope/rotation, configuration validation, SMTP response classification, header safety, and masking.
- Add PostgreSQL tests for persistence, idempotency conflict, exact locale and recipient eligibility, concurrent claims, retries, stale recovery, User deletion cancellation, key absence, decryption corruption, terminal content purge, and retention.
- Keep SQLite coverage focused on migration execution and local single-Worker smoke compatibility.
- Add API tests proving IDs are strings and raw recipient, subject, body, variables, ciphertext, credentials, and full SMTP responses never appear.
- Add frontend component/API tests for list filters, safe details, loading, empty, error, permission-denied, bilingual labels, and sensitive-data non-disclosure.
- Add CLI tests for required arguments, idempotent behavior, and production refusal.
- Add optional Mailpit compatibility coverage behind `pnpm test:smtp-integration` and a manual workflow. Do not make normal `pnpm test`, push Verify, or default local startup require Docker or SMTP.
- Preserve all existing backend-core, infrastructure, Webhook, file-storage, optional adapter, frontend, migration, and build tests.
- Required final validation is `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm db:migrate`, `pnpm db:migrate:postgresql`, `pnpm build`, and `pnpm test:smtp-integration` when the optional Mailpit environment is running.

## Out of Scope

- Public or administrator arbitrary-email creation API
- Example business modules, business event triggers, or default email template content
- Sending to locked, disabled, deleted, or address-less Users through a bypass flag
- Email-specific locale fallback
- HTML email, attachments, inline media, multiple To recipients, CC, BCC, Reply-To, or custom headers
- Manual retry, manual cancellation, or Delivery export
- Bounce/DSN handling, inbox-delivery confirmation, open tracking, or click tracking
- Exactly-once guarantees or cross-Delivery ordering
- Automatic recipient or template changes to accepted snapshots
- Generic queue, RabbitMQ, event Outbox, or in-app Notification persistence for email work
- Separate email dead-letter queue
- SMS sending
- Production SMTP provider selection or target-environment deployment acceptance

## Further Notes

- The feature must remain disabled by default and optional for local development, CI, and deployment validation.
- The existing production environment remains pending; implementation completion must not be reported as production SMTP acceptance.
- `docs/email_delivery_design.md`, ADR 0003, `CONTEXT.md`, and the base-system PRD/design specification are authoritative inputs for implementation.
- No SQL Server implementation or migration may be added.
- No example business module may be introduced to demonstrate email sending.
