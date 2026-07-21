# Reliable Email Notification Delivery Design

## Scope

Implement reliable SMTP email delivery for the existing notification template and SMTP adapter boundaries. The feature remains optional and disabled by default. It does not add a public arbitrary-email API, business-module trigger, SMS sender, marketing campaign system, bounce processor, or production SMTP-provider acceptance.

## Domain Contract

An internal Email Notification Request contains:

- `requestKey`
- `userId`
- `templateCode`
- a strict primitive variable map
- optional `referenceType` and `referenceId`

One request creates one Email Delivery for one User. New requests require an enabled, non-deleted User with a valid email address. Locked, disabled, deleted, or address-less Users are rejected. A request uses the User's Effective Language and requires one enabled `channel=email` template with an exact locale match; no email-specific language fallback is allowed.

The request resolves and renders the recipient, subject, and body before persistence. Later email, language, or template changes do not alter an accepted delivery. Later lock or disable changes do not cancel it. Soft deletion cancels unfinished work; a running SMTP operation may finish.

## Idempotency

The pair `requestKey + userId + channel=email` is unique. A canonical SHA-256 fingerprint covers `userId`, `templateCode`, normalized variables, `referenceType`, and `referenceId`.

- Matching key and fingerprint returns the existing Email Delivery.
- Matching key with a different fingerprint returns an idempotency-conflict error.
- The fingerprint excludes resolved email, locale, and rendered content.
- Idempotency lookup precedes feature and current-recipient eligibility checks for an already accepted request.

## Template Contract

Notification Template identity is the immutable triple `channel + code + locale`. The database uniqueness rule must permit one conceptual code and locale to have separate in-app, email, and reserved SMS templates. Updates may change subject, body, declared variables, and status, but not identity fields.

For email templates:

- Subject and body placeholders must exactly match the declared variable set.
- Request variables must include every declared variable and no others.
- Values are limited to string, number, boolean, or null.
- Both existing `{name}` and `{{name}}` syntax remain readable; documentation uses `{name}` as the canonical form.
- Rendering and validation finish before persistence. The Worker never interprets variables.

An Email Delivery records template ID, code, locale, and template update time for safe historical identification.

## Persistence

Add `email_deliveries` and `email_delivery_attempts` to SQLite and PostgreSQL. IDs use database auto-increment and API JSON serializes them as strings.

An Email Delivery stores the idempotency key and fingerprint, User reference, template identity snapshot, masked recipient hint, stable Message ID, encrypted content key ID and versioned envelope, state and retry fields, lock ownership/timestamps, safe final result, content purge time, references, and UTC lifecycle timestamps.

An Email Delivery Attempt stores its delivery ID, attempt number, status, start/end time, duration, safe SMTP response code, safe error code and summary, and UTC creation time. It never stores the recipient, subject, body, credentials, full SMTP response, or encrypted envelope.

States are `pending`, `running`, `succeeded`, `failed`, and `canceled`. Email Delivery is the only reliable work authority. Do not create `queue_jobs`, `event_outbox`, or generic `notifications` rows for this flow.

## Content Protection

Recipient, subject, and body are stored together in a versioned AES-256-GCM envelope under a dedicated keyring. The Webhook keyring is not reused. Suggested configuration names are:

```text
EMAIL_CONTENT_KEYS=
EMAIL_CONTENT_ACTIVE_KEY_ID=
```

Only creation and SMTP sending hold plaintext. APIs, logs, alerts, metrics, and attempt rows exclude plaintext and ciphertext. List/detail responses expose only a masked recipient hint and safe metadata.

When a delivery enters any terminal state, the same transaction clears encrypted content and records `content_purged_at`. A scan-default, explicit `--apply` migration command rotates pending/running envelopes or plaintext from a failed legacy transition.

The Worker checks `content_key_id` before claiming work. A missing key leaves the Delivery pending without creating an Attempt or consuming its attempt count, degrades Worker health, and emits a deduplicated safe alert. Restoring the key resumes processing. If the key exists but AES-GCM authentication fails, the Delivery ends as `failed` with `CONTENT_DECRYPTION_FAILED`, emits a high-severity alert, and purges the unusable ciphertext. Key rotation must prove that no pending/running Delivery references an old key before operators remove it.

## Worker Processing

The Worker polls `email_deliveries` directly. PostgreSQL claims use `FOR UPDATE SKIP LOCKED`; SQLite preserves local single-Worker behavior. A Delivery has at most one running Attempt, while different Deliveries for the same User may run concurrently. Cross-email ordering is not guaranteed.

Each Delivery receives one stable Message ID at creation, reused on every Attempt. SMTP Acceptance after DATA is the success boundary. This does not prove inbox delivery. A crash after SMTP Acceptance but before the database commit can cause a duplicate with the same Message ID, so the guarantee is at least once.

Stale `running` work returns to `pending` unless its attempt limit is exhausted. Global reliable-delivery or SMTP disablement pauses pending work without consuming an attempt.

## Retry Policy

The first send is attempt 1. Default maximum attempts are 5. Retry delays are 30 seconds, 2 minutes, 10 minutes, and 30 minutes.

Retryable failures:

- network interruption, connection failure, DNS failure, or timeout
- SMTP `4xx` temporary responses

Final failures:

- SMTP `5xx` responses, including authentication rejection
- TLS certificate or hostname validation failure
- missing STARTTLS on a remote plaintext connection
- malformed protocol response or local configuration error
- exhausted attempts

Final failure calls AlertIntegration with IDs, template code, masked recipient hint, attempt count, safe code, and timestamps only. No separate dead-letter queue is added.

## SMTP Transport Security

`SMTP_SECURE=true` uses implicit TLS. With `SMTP_SECURE=false`, remote servers must advertise STARTTLS; the client upgrades, verifies the certificate and hostname with Node.js defaults, sends EHLO again, and only then authenticates or transmits message content.

`SMTP_ALLOW_INSECURE_LOCALHOST=true` permits plaintext only for loopback SMTP in development/test and is rejected in production. Username and password must be configured together and are never sent over plaintext. Messages are UTF-8 `text/plain`, one To recipient, deployment-configured From, and no HTML, attachment, inline image, CC, BCC, Reply-To, or custom header support.

## Configuration

```text
EMAIL_DELIVERY_ENABLED=false
EMAIL_DELIVERY_CONCURRENCY=4
EMAIL_DELIVERY_MAX_ATTEMPTS=5
EMAIL_DELIVERY_RETENTION_DAYS=90
EMAIL_DELIVERY_STALE_SECONDS=900
EMAIL_CONTENT_KEYS=
EMAIL_CONTENT_ACTIVE_KEY_ID=
SMTP_ENABLED=false
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_ALLOW_INSECURE_LOCALHOST=false
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_FROM=
SMTP_TIMEOUT_MS=10000
```

`EMAIL_DELIVERY_ENABLED=true` requires a valid content keyring in API and Worker. `SMTP_ENABLED=true` requires a valid SMTP destination and transport configuration in API and Worker. Reliable delivery enabled with SMTP disabled accepts encrypted pending work but does not claim it. Both switches default off.

Message ID domain is derived from the configured From address where possible, otherwise `web-admin-base.local`. Configuration changes take effect after restart.

## Management API And UI

Add authenticated read-only management APIs and a bilingual frontend page for delivery list/detail. Filters cover User, template code, locale, state, and creation time range. Safe list data includes IDs, User, masked recipient, template identity, state, attempt counts, and lifecycle times. Safe detail adds Attempt timing, duration, SMTP code, and redacted errors.

Use `notification:email-delivery:view` for page and API access. Keep Hono RPC internal typing and explicit OpenAPI request/response schemas. Do not add public create, manual retry, manual cancel, or export APIs. The existing template test-send endpoint remains synchronous diagnosis, is controlled by `SMTP_ENABLED`, and does not create reliable-delivery history.

## Retention And Observability

Terminal Delivery and Attempt metadata is retained for 90 days by default, configurable from 1 to 3650 days. Pending/running work is never deleted by retention. Cleanup runs as a distributed singleton through LockAdapter.

Structured Attempt logs contain delivery/request IDs, User ID, template code, locale, masked recipient, attempt number, safe SMTP code, duration, outcome, trace/request ID when available, and safe error code. They exclude raw addresses, Message content, credentials, full SMTP responses, and encryption material.

## Development And Verification

Normal tests use a process-local Node SMTP/STARTTLS server. Add a pinned, optional Mailpit Docker environment bound to `127.0.0.1`, with no persistent production data and an initial 128 MB memory limit. `pnpm test:smtp-integration` and a manually triggered workflow verify real compatibility without adding Mailpit to normal push Verify.

Provide a development/test-only `pnpm email:delivery:request -- ...` CLI that calls the same internal request service. It requires explicit User, template, request key, and variables and refuses production execution. It does not seed users, templates, or example business data.

Tests cover strict template variables, exact locale, recipient eligibility, idempotency/conflict, encryption/rotation, content purge, typed SMTP errors, TLS/STARTTLS policy, stable Message ID, SMTP Acceptance, retry/final classification, stale recovery, concurrent PostgreSQL claims, soft-delete cancellation, retention lock, safe APIs, frontend states, SQLite migration smoke, PostgreSQL persistence, CLI guards, and optional Mailpit compatibility.

## Explicitly Out Of Scope

- Public or administrator arbitrary-email creation API
- Business-module email triggers or default template content
- HTML, attachments, inline media, multiple recipients, CC/BCC, or custom headers
- Manual retry, cancellation, or export
- Bounce/DSN, inbox delivery, open, or click tracking
- SMS sending
- Separate email DLQ
- Production SMTP provider selection or target-environment acceptance
