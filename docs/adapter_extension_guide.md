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
- local filesystem storage with temp-file-then-rename writes

## Rules

- Keep Redis, RabbitMQ, S3, SMTP, and other external drivers optional unless explicitly confirmed.
- Do not bypass adapter interfaces from API or worker modules.
- Keep driver configuration explicit and validated.
- Add contract tests for each new driver.
- Do not introduce SQL Server v1 adapter code.
