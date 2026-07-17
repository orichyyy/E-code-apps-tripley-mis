# Release Readiness

Use this document as the final go/no-go entry point before handing off or releasing the Web Admin Base System foundation.

## Required Inputs

Before marking a release candidate ready, identify:

- Commit hash under review.
- Target environment: local demo, staging, or production.
- Database mode: SQLite local/demo or PostgreSQL deployment.
- CI run or local `pnpm verify` result.
- Current `docs/known_gaps.md` review result.

## Quality Gate

The release candidate must pass the unified verification command:

```bash
pnpm verify
```

Expected coverage:

- `pnpm format`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- SQLite migrations through `pnpm db:migrate`
- PostgreSQL migrations through `pnpm db:migrate:postgresql`
- SQLite local smoke through `pnpm smoke:local`
- production build through `pnpm build`

PostgreSQL verification requires `TEST_DATABASE_URL` or `DATABASE_URL`.

## CI Gate

For repository-hosted changes, the GitHub Actions Verify workflow must pass.

Expected CI behavior:

- Starts PostgreSQL 16.
- Sets `TEST_DATABASE_URL`.
- Installs dependencies with `pnpm install --frozen-lockfile`.
- Installs Playwright Chromium.
- Runs `pnpm verify`.
- Does not require Redis, RabbitMQ, S3-compatible storage, SMTP, SMS, or enabling outbound Webhook delivery.

## Acceptance Gates

Local acceptance:

- Follow `docs/local_run_acceptance.md`.
- Confirm the SQLite local/demo path can be run and manually inspected.
- Confirm the browser checklist passes for implemented base-system pages.

Deployment acceptance:

- Follow `docs/deployment_acceptance.md`.
- Confirm PostgreSQL migrations, API, static SPA, worker, file storage, authentication, OpenAPI, logs, scheduler, import/export, files, notifications, and core management surfaces pass their deployment checks.

## Go / No-Go Checklist

Mark Go only when all applicable items are true:

- `pnpm verify` passed for the release candidate commit.
- CI Verify passed, when CI is available for the branch or pull request.
- `docs/local_run_acceptance.md` completed for local/demo handoff.
- `docs/deployment_acceptance.md` completed for staging/production handoff.
- `docs/known_gaps.md` was reviewed and still only lists validation prerequisites, explicit boundaries, reserved optional integrations, or schema boundaries.
- No example business module exists.
- No SQL Server runtime, SQL Server migration, or SQL Server deployment support exists in v1.
- Node.js remains the only backend runtime target.
- SQLite remains usable for local development, local testing, and demo.
- PostgreSQL remains the supported deployment database.
- Drizzle migrations work for SQLite and PostgreSQL.
- API JSON IDs are serialized as strings.
- UTC timestamp and soft-delete rules remain documented and implemented where lifecycle deletion applies.
- Organization tree behavior preserves the confirmed BIGINT materialized-path design and does not allow v1 organization moves.
- Hono RPC internal frontend typing remains available; OpenAPI remains documentation.
- Adapter abstractions remain respected for cache, lock, queue, event bus, rate limit, token store, scheduler, file storage, and notification channels.
- Optional integrations are not treated as required release blockers unless explicitly enabled for the target environment.

## Optional Integration Status

These are not required for base-system release readiness:

- Redis cache/rate-limit drivers.
- RabbitMQ queue/event-bus drivers.
- S3-compatible file storage concrete driver and configuration UI.
- SMS notification sending.
- Target-environment Webhook destination acceptance and out-of-scope replay/custom-header features.
- Dedicated dead-letter queue beyond the existing `dead_letter` job status.

If any of these are required by the target environment, create a separate goal and do not mark the release candidate ready until that goal has code, tests where applicable, documentation, and updated acceptance criteria.

## Evidence To Record

For release or handoff, record:

- Commit hash.
- Release date.
- Environment name.
- Node.js and pnpm versions.
- PostgreSQL version for deployment acceptance.
- `pnpm verify` result.
- CI Verify run link, when available.
- Local acceptance result or reason it is not applicable.
- Deployment acceptance result or reason it is not applicable.
- Known gaps reviewed.
- Any deviations, owners, and follow-up goals.

## Readiness Decision

Use these outcomes:

- Go: all required gates passed, and remaining gaps are documented non-blockers.
- No-Go: a required quality, CI, local acceptance, deployment acceptance, security, persistence, or documentation gate failed.
- Conditional Go: only for non-production handoff where the failed item is explicitly documented, accepted by the owner, and not required for the target environment.

Do not claim a feature, integration, or deployment mode is complete unless it has code, tests where applicable, documentation, and acceptance coverage.
