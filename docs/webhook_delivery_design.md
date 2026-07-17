# Outbound Webhook Delivery Design

This document records the confirmed design for the next implementation goal. It complements ADR 0002 and does not describe already implemented behavior.

## Scope

Implement reliable outbound Webhook delivery for the existing subscription management module. The implementation supports both system-event subscriptions and a directed notification channel without introducing a public arbitrary-notification API.

The initial controlled event catalog is:

| Event type | Trigger |
| --- | --- |
| `user.created` | A user creation transaction commits. Initialization of the first super administrator is excluded. |
| `job.failed` | A queue or scheduled job exhausts its configured attempts. Webhook pipeline jobs are excluded. |
| `permission.changed` | A supported permission mutation commits and changes persisted state. |
| `notification.requested` | An internal caller requests a directed notification to one Webhook Subscription. |

Unknown event types are rejected when a subscription is created or updated. Frontend subscription forms use the event catalog rather than free-form strings.

## Event Contract

Requests use a CloudEvents 1.0-compatible structured JSON envelope without requiring a CloudEvents runtime dependency:

```json
{
  "specversion": "1.0",
  "id": "123",
  "type": "user.created",
  "source": "web-admin-base-system",
  "time": "2026-07-14T08:00:00.000Z",
  "subject": "users/456",
  "datacontenttype": "application/json",
  "data": {}
}
```

The event ID is stable across retries. All times are UTC, all JSON IDs are strings, and payload schemas are strict. JWTs, cookies, passwords, secrets, full request bodies, exception stacks, and arbitrary metadata are prohibited.

Initial event data is limited to:

- `user.created`: `userId`, `primaryOrganizationId`, `createdByUserId`.
- `job.failed`: `jobId`, `jobKind`, `jobCode`, `attempt`, `maxAttempts`.
- `permission.changed`: `targetType`, `targetId`, `organizationId`, `changeType`, `changedByUserId`. Permission manifest synchronization uses `targetType = system`, `targetId = permission-manifest`, and `changeType = manifestSync`.
- `notification.requested`: `notificationId`, `subject`, `body`, `locale`, `referenceType`, `referenceId`.

For `notification.requested`, the internal caller supplies one subscription ID. The subscription must be enabled and include `notification.requested` in its event types. Other initial events fan out to every enabled matching subscription.

## Persistence And Processing

Use three durable layers:

1. `event_outbox` stores the event in the same transaction as its domain mutation.
2. `webhook_deliveries` stores one immutable event/subscription-revision relationship, its state, retry schedule, and final result. A unique event/subscription constraint makes fan-out idempotent.
3. `webhook_delivery_attempts` stores one immutable record per HTTP request, including timing, outcome, HTTP status, and a safe error summary.

Delivery states are `pending`, `running`, `succeeded`, `failed`, and `canceled`. PostgreSQL supports concurrent claims across workers; SQLite preserves local/demo behavior. The database Outbox remains authoritative even when RabbitMQ is configured.

Delivery is at least once. A worker crash after the receiver accepts a request but before the database update commits may produce a duplicate with the same event ID. No cross-event ordering is guaranteed. At most one request per subscription may be running at once, while different subscriptions may run concurrently.

Changing a subscription's URL, event types, secret, or status increments its revision and cancels pending deliveries for the old revision. Changing its name does not. Disabling or soft-deleting a subscription cancels pending deliveries; running requests may finish. A global feature disable pauses pending deliveries without canceling them.

Add `DELETE /api/webhooks/:id` with `webhook:delete`. It soft deletes the subscription and preserves delivery history until normal retention cleanup.

## HTTP And Retry Policy

HTTP `2xx` is success. Network failures, timeouts, `408`, `425`, `429`, and `5xx` are retryable. Other `4xx` and all `3xx` are final failures. Redirects are never followed.

Defaults:

- Request timeout: 10 seconds.
- Maximum attempts: 5, including the first attempt.
- Retry delays: 30 seconds, 2 minutes, 10 minutes, and 30 minutes.
- A valid `Retry-After` on `429` or `503` overrides the schedule within a 30-second to 1-hour bound.
- Worker concurrency: 4, configurable from 1 to 32.
- Response read limit: 64 KiB; response bodies are not persisted.

Exhausted deliveries become `failed`; no separate dead-letter queue is added. Repeated failures do not automatically disable a subscription.

## Request Authentication

When a subscription has a secret, sign the exact UTF-8 body using HMAC-SHA256 over:

```text
<unix-timestamp>.<raw-request-body>
```

Send:

```text
Content-Type: application/cloudevents+json
User-Agent: web-admin-base-system-webhook/1.0
X-Webhook-Id: <delivery-id>
X-Webhook-Event: <event-type>
X-Webhook-Attempt: <attempt-number>
X-Webhook-Timestamp: <unix-seconds>
X-Webhook-Signature: v1=<hex-hmac>
```

The signature header is omitted when no secret is configured. Custom headers and Authorization configuration are outside this goal.

## Secret Encryption

Persist secrets as versioned AES-256-GCM envelopes:

```text
enc:v1:<keyId>:<iv>:<ciphertext>:<authTag>
```

Configuration uses a JSON keyring and active key ID:

```text
WEBHOOK_SECRET_KEYS={"2026-01":"<base64-32-byte-key>"}
WEBHOOK_SECRET_ACTIVE_KEY_ID=2026-01
```

Key IDs allow letters, digits, dots, underscores, and hyphens and are at most 64 characters. Each key decodes to exactly 32 bytes. Creating or replacing a secret and enabling delivery require the appropriate key configuration.

`pnpm webhook:secrets:migrate` performs a read-only scan. `pnpm webhook:secrets:migrate -- --apply` encrypts legacy plaintext and re-encrypts records under the active key in batches. Output never includes plaintext or ciphertext. A delivery whose configured secret cannot be decrypted fails without sending.

## Destination Security

Production destinations require HTTPS. URLs containing credentials or fragments are invalid, and redirects are rejected. Creation and update perform static validation; every attempt repeats validation and DNS resolution.

The sender rejects loopback, private, link-local, multicast, unspecified, local IPv6, and cloud-metadata address ranges. It connects through a validated pinned address while preserving the original Host and TLS SNI. `WEBHOOK_ALLOWED_HOSTS` may allow exact hostnames that resolve privately, but production still requires HTTPS. `WEBHOOK_ALLOW_INSECURE_LOCALHOST=true` is test/development-only and is rejected in production. There is no global private-network bypass.

## API And Frontend

Add:

- `GET /api/webhook-event-types`
- `GET /api/webhook-deliveries`
- `GET /api/webhook-deliveries/:id`
- `DELETE /api/webhooks/:id`

The Webhook page has Subscriptions and Deliveries tabs. Delivery list filters cover subscription, event type, status, and time range. Delivery details show attempt timing, HTTP status, duration, and safe error summaries. The API and UI never expose secrets, signatures, complete event payloads, response bodies, or sensitive request headers. Manual replay, manual cancellation, and delivery export are outside this goal.

## Configuration

```text
WEBHOOK_DELIVERY_ENABLED=false
WEBHOOK_EVENT_SOURCE=web-admin-base-system
WEBHOOK_REQUEST_TIMEOUT_MS=10000
WEBHOOK_MAX_ATTEMPTS=5
WEBHOOK_DELIVERY_CONCURRENCY=4
WEBHOOK_DELIVERY_RETENTION_DAYS=90
WEBHOOK_ALLOWED_HOSTS=
WEBHOOK_ALLOW_INSECURE_LOCALHOST=false
WEBHOOK_SECRET_KEYS=
WEBHOOK_SECRET_ACTIVE_KEY_ID=
```

When delivery is disabled, subscription management and history remain available, no new Webhook Outbox events are created, and existing pending deliveries are paused. Configuration changes take effect after API and Worker restart.

## Retention And Observability

Terminal deliveries and attempts are retained for 90 days by default, configurable from 1 to 3650 days. Published Outbox records are retained for 7 days and failed Outbox records for 90 days. Pending and running deliveries are never deleted by retention. Cleanup is a database singleton Worker task protected by the existing LockAdapter.

Each attempt emits a structured log with event, delivery, subscription, event type, attempt, target hostname, HTTP status, duration, outcome, and available request/trace ID. It excludes URL path/query, bodies, signatures, secrets, and ciphertext. Final failure calls the existing no-op-by-default AlertIntegration boundary. The existing metrics endpoint remains a placeholder; internal metric counters may be added without a new external dependency.

## Verification

Normal tests and GitHub Verify use a Node.js receiver bound only to `127.0.0.1`; no Docker service or public network is required. Coverage includes configuration, encryption and rotation, signature vectors, SSRF controls, strict event schemas, transactional Outbox behavior, fan-out idempotency, directed notifications, retry decisions, crash recovery, multi-worker claims, revision cancellation, PostgreSQL persistence, SQLite migration smoke, API/OpenAPI/Hono RPC typing, frontend states, and sensitive-data non-disclosure.
