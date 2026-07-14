# Troubleshooting Guide

## `pnpm db:migrate:postgresql` Fails

PostgreSQL migration execution requires an explicit database URL:

```text
TEST_DATABASE_URL=postgres://...
```

`pnpm db:migrate` itself runs SQLite by default and skips PostgreSQL when no PostgreSQL URL is present. Use `TEST_DATABASE_URL` for local PostgreSQL migration smoke tests.

## `better-sqlite3` Binding Is Missing

The workspace allows the `better-sqlite3` build script through `pnpm-workspace.yaml`. If a local install still reports a missing native binding, run:

```bash
pnpm rebuild better-sqlite3
```

## API Route Returns 403

Private routes are checked against `packages/contracts/src/manifests/base-api-permissions.ts`.

Verify:

- Bearer access token is present.
- User has an active session.
- Current organization is enabled and not deleted.
- Role has the required permission code.

## OpenAPI Route Missing an Endpoint

Every implemented API route must have an API permission manifest entry. Run:

```bash
pnpm --filter @web-admin-base/api test
pnpm --filter @web-admin-base/contracts test
```

## SMTP Test Send Fails

SMTP sending is disabled unless `SMTP_ENABLED=true`. When enabled, `SMTP_HOST` and `SMTP_FROM` are required. Use `SMTP_SECURE=true` only for implicit TLS SMTP endpoints; plaintext local capture tools usually use `SMTP_SECURE=false`.

## Worker Does Not Process Queue Jobs

The worker uses `DATABASE_DIALECT` and `DATABASE_URL` to connect to the durable queue and scheduler tables. Run migrations first, then set `WORKER_POLL_INTERVAL_MS` to a positive value for continuous polling. With the default `0`, jobs are processed only when `runOnce()` is called by tests or embedding code.

If a queued job does not run, inspect `queue_jobs.status`, `attempt`, `max_attempts`, `next_run_at`, `locked_by`, `locked_at`, and `last_error`. Jobs left in `running` beyond the worker timeout are recovered on the next poll; jobs that exhaust attempts use the existing `dead_letter` status.

If a scheduled task runs too often or not at all, inspect `scheduled_jobs.cron_expression`, `next_run_at`, `attempt`, `max_attempts`, and `last_error`, then check `log_entries` where `log_type = 'scheduler'` for execution results.

If CSV log exports remain pending, confirm the worker is running with the same `DATABASE_URL` and `FILE_STORAGE_ROOT` as the API process. The base worker catalog processes `import_export_tasks` whose `resource_type` is `logs:<logType>` and writes the generated file metadata to `file_objects`.

## S3-Compatible File Access

- Startup `HeadBucket` failures: verify endpoint, region, bucket, path-style setting, network access, and credentials. Production startup does not create missing buckets.
- Existing S3 files fail after switching uploads back to local: keep the S3 configuration available so the router can resolve recorded S3 locations; changing `FILE_STORAGE_DRIVER` affects new uploads only.
- A download returns 401/403/404 without a presigned redirect: authentication, authorization, and file-state checks intentionally run before signing.
- Cleanup repeatedly reports a file: inspect `file_objects.storage_driver`, `storage_bucket`, `object_key`, and `content_deleted_at`. Failed physical deletions remain null and retry on a later cleanup run.
- RustFS compatibility failure: run `scripts/rustfs-dev.ps1 -Action Status`, inspect `docker logs web-admin-base-rustfs`, and rerun `pnpm test:s3-integration`. Do not expose or log presigned query strings while diagnosing.

## Infrastructure API Returns Placeholder Data In The Frontend

The frontend calls real APIs for modules whose backend routes are implemented. It falls back to typed placeholder data when:

- no access token is stored in `localStorage`
- the API is not running
- the backend route is still listed in `docs/known_gaps.md`
- the authenticated user lacks the required permission

## Request ID Issues

The API accepts valid incoming `x-request-id`, generates one when absent, returns it in response headers, and includes it in structured access-log entries.
