# Handoff: Optional Adapter Runtime Wiring

Date: 2026-07-08  
Repository: `E:\code\apps\tripley-mis` on the original PC

## Current State

- Current working branch: `codex/optional-adapter-runtime-wiring`
- Open PR: https://github.com/orichyyy/E-code-apps-tripley-mis/pull/2
- PR state: open, clean, not merged
- PR head commit: `f730b3825ccc66ce70d49f5683c426c01cf4a6ef`
- GitHub Actions check: `pnpm verify` passed
- CI job: https://github.com/orichyyy/E-code-apps-tripley-mis/actions/runs/28835932017/job/85519625660
- Original PC working tree was clean after the last implementation turn.

The PR contains two commits:

- `32978e6 feat: add optional redis and rabbitmq adapters`
- `f730b38 feat: wire optional redis and rabbitmq runtime config`

## What Was Completed

The base system already had in-memory and database-backed infrastructure adapters. This work added optional Redis and RabbitMQ support without making them mandatory.

Implemented:

- Optional Redis cache adapter and Redis rate-limit adapter.
- Optional RabbitMQ queue adapter and RabbitMQ event-bus adapter.
- Docker Desktop helper script for lightweight local Redis/RabbitMQ containers:
  - `scripts/start-optional-integrations.ps1`
  - Redis image: `redis:8.8.0-alpine`
  - RabbitMQ image: `rabbitmq:4.3.2-alpine`
- Optional integration test command:
  - `pnpm test:optional-integrations`
- API runtime configuration for:
  - `CACHE_DRIVER=memory|database|redis`
  - `RATE_LIMIT_DRIVER=memory|database|redis`
  - `QUEUE_DRIVER=memory|database|rabbitmq`
  - `EVENT_BUS_DRIVER=in_process|database|rabbitmq`
  - `REDIS_URL`
  - `RABBITMQ_URL`
- Worker runtime support for `QUEUE_DRIVER=rabbitmq`.
- Worker keeps the database durable queue and scheduler active even when RabbitMQ is enabled, because existing scheduled-task, import/export, and log-export flows are database-backed.
- Windows local smoke cleanup was hardened for transient SQLite file locks.

Relevant docs updated:

- `README.md`
- `docs/local_development_guide.md`
- `docs/adapter_extension_guide.md`
- `docs/known_gaps.md`
- `docs/base_system_status_matrix.md`
- `docs/implementation_plan.md`

## Validation Already Run

On the original PC:

```powershell
pnpm verify
```

Passed.

Optional Docker-backed integration validation:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-optional-integrations.ps1
$env:REDIS_URL = "redis://127.0.0.1:6379"
$env:RABBITMQ_URL = "amqp://guest:guest@127.0.0.1:5672"
pnpm test:optional-integrations
docker stop tripley-redis-dev tripley-rabbitmq-dev
```

Passed.

GitHub Actions:

- PR #2 `pnpm verify`: passed.

## Restore On Another PC

Clone or fetch the repo, then continue from the PR branch:

```powershell
git fetch origin
git switch codex/optional-adapter-runtime-wiring
git pull --ff-only origin codex/optional-adapter-runtime-wiring
pnpm install
```

For normal validation, configure PostgreSQL test env as usual:

```powershell
$env:TEST_DATABASE_URL = "<redacted-postgresql-test-url>"
pnpm verify
```

For optional Redis/RabbitMQ validation:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-optional-integrations.ps1
$env:REDIS_URL = "redis://127.0.0.1:6379"
$env:RABBITMQ_URL = "amqp://guest:guest@127.0.0.1:5672"
pnpm test:optional-integrations
docker stop tripley-redis-dev tripley-rabbitmq-dev
```

No secrets are included in this document. The GitHub token used on the original PC was read from the user environment variable `GIT_TOKEN` and was not printed.

## Recommended Next Steps

1. Review PR #2 and merge it if no changes are requested.
2. After merge, sync `main` locally and confirm GitHub Actions passes on `main`.
3. Keep target-environment deployment acceptance pending until the target staging/production-like environment is ready.
4. The next optional integration slice can be one of:
   - S3-compatible file storage driver and configuration contract.
   - Outbound Webhook delivery was pending at handoff time; it is implemented in later commits and documented in `docs/webhook_delivery_design.md`.
   - SMS sender integration, if a provider and contract are confirmed.
   - Further RabbitMQ production semantics, if queue retry/dead-letter behavior should move beyond the current adapter boundary.

## Suggested Skills

- `$implement`: for continuing feature work or merging fixes after PR review.
- `$tdd`: for any next adapter/provider integration, especially S3, webhook delivery, or SMS.
- `$diagnosing-bugs`: if CI, Docker Desktop, local smoke, or PostgreSQL validation fails on the new PC.
- `$handoff`: to refresh this document after PR #2 is merged or after the next integration slice.

## Important Boundaries To Preserve

- Do not add SQL Server support or SQL Server migrations.
- Do not implement an example business module.
- Keep Node.js as the only backend runtime.
- Keep Redis and RabbitMQ optional unless explicitly configured.
- Keep SQLite usable for local/demo and PostgreSQL as the supported deployment database.
- Do not replace frontend internal Hono RPC typing with OpenAPI client generation.
- Do not mark target-environment deployment acceptance complete until it is actually run in that environment.
