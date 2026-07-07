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
- optional SMTP notification channel over Node.js built-ins, enabled only through explicit SMTP configuration

## Rules

- Keep Redis, RabbitMQ, S3, webhook delivery, SMS, and other external drivers optional unless explicitly confirmed.
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
