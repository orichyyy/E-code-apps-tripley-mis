# Adapter Extension Guide

Adapters live in `packages/adapters`.

Implemented boundaries include:

- `CacheAdapter`
- `LockAdapter`
- `QueueAdapter`
- `EventBusAdapter`
- `RateLimitAdapter`
- `TokenStoreAdapter`
- `JobSchedulerAdapter`
- `FileStorageAdapter`
- `NotificationChannelAdapter`

Implemented v1 drivers include:

- in-memory cache, lock, queue, event bus, rate limit, scheduler, token store, and notifications
- database cache, rate limit, lease-table lock, queue, event outbox, and scheduler drivers over the v1 infrastructure tables
- optional Redis cache and rate-limit drivers
- optional RabbitMQ queue and event-bus drivers
- local filesystem storage with temp-file-then-rename writes
- optional AWS SDK v3 S3-compatible storage with custom endpoints, path-style requests, private presigned downloads, and mixed local/S3 object routing
- optional SMTP notification channel over Node.js built-ins, enabled only through explicit SMTP configuration

## Rules

- Keep Redis, RabbitMQ, S3, outbound Webhook delivery, SMS, and other external drivers optional unless explicitly configured.
- Do not bypass adapter interfaces from API or worker modules.
- Keep driver configuration explicit and validated.
- Add contract tests for each new driver.
- Do not introduce SQL Server v1 adapter code.

## Optional Redis and RabbitMQ Development Tests

Redis and RabbitMQ are not required for normal local startup, CI, or deployment acceptance. To run the optional adapter integration tests locally:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-optional-integrations.ps1
$env:REDIS_URL = "redis://127.0.0.1:6379"
$env:RABBITMQ_URL = "amqp://guest:guest@127.0.0.1:5672"
pnpm test:optional-integrations
```

The helper script uses lightweight official Alpine images by default: `redis:8.8.0-alpine` and `rabbitmq:4.3.2-alpine`. RabbitMQ management UI is not started by default.

Runtime opt-in is controlled by environment variables:

- `CACHE_DRIVER=memory|database|redis`
- `RATE_LIMIT_DRIVER=memory|database|redis`
- `QUEUE_DRIVER=memory|database|rabbitmq`
- `EVENT_BUS_DRIVER=in_process|database|rabbitmq`
- `REDIS_URL`
- `RABBITMQ_URL`

The current worker keeps the database durable queue/scheduler active even when `QUEUE_DRIVER=rabbitmq`, because existing scheduled-task and import/export flows are database-backed.

## Optional S3-Compatible Storage

`FileStorageAdapter` stores and consumes a complete Object Location: `storageDriver`, nullable `storageBucket`, and complete `objectKey`. New writes use the configured active driver; reads, previews, deletes, cleanup, and import/export access route through each persisted location. A new driver must preserve this behavior and must not infer a location from the current active driver.

The S3 implementation uses `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`. It supports explicit credentials or the AWS SDK default credential chain, custom endpoints, path-style requests, an optional normalized key prefix, `HeadBucket` validation, and explicit development/test bucket creation. Production buckets must be provisioned externally.

Run the generic compatibility suite against the pinned RustFS test backend:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/rustfs-dev.ps1
pnpm test:s3-integration
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/rustfs-dev.ps1 -Action Stop
```

Application code uses only the generic S3 protocol. RustFS is a compatibility-test backend, not a production provider selection.

## Outbound Webhook Boundary

The Webhook notification channel publishes a directed `notification.requested` record to the database Outbox. System events also enter the Outbox transactionally with their domain mutation. The Worker remains responsible for subscription fan-out, secure HTTP delivery, retry classification, and immutable attempt history.

Do not bypass the destination policy or log complete URLs, bodies, headers, signatures, secrets, or ciphertext. A replacement HTTP transport must preserve DNS validation and address pinning, reject redirects, enforce response limits, and return only status/duration/`Retry-After` metadata. The database Outbox remains authoritative even when RabbitMQ is enabled.

## Reliable Email Boundary

`NotificationChannelAdapter` transports one already-rendered email snapshot. The Email Delivery aggregate, not the generic Queue, owns claims, retries, attempts, and history. SMTP adapters must preserve the supplied stable Message ID, return typed sanitized failures, require implicit TLS or STARTTLS remotely, and never log recipient/content/credentials/server response text. Local plaintext is allowed only through the explicit loopback development/test option.
