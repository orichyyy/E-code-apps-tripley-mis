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

## Rules

- Keep Redis, RabbitMQ, S3, SMTP, and other external drivers optional unless explicitly confirmed.
- Do not bypass adapter interfaces from API or worker modules.
- Keep driver configuration explicit and validated.
- Add contract tests for each new driver.
- Do not introduce SQL Server v1 adapter code.
