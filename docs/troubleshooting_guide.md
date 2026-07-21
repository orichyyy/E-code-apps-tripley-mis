# Troubleshooting Guide

## `pnpm db:migrate:postgresql` Fails

PostgreSQL migration execution requires an explicit database URL:

```text
TEST_DATABASE_URL=postgres://...
```

`pnpm db:migrate` itself runs SQLite by default and skips PostgreSQL when no PostgreSQL URL is present. Use `TEST_DATABASE_URL` for local PostgreSQL migration smoke tests.

If migration reports a legacy `schema_migrations` shape, rebuild only the intended internal development/test database, then rerun migrations. The runner intentionally has no automatic destructive reset or checksum-baseline compatibility path. Never apply that reset procedure to a retained deployment database.

If migration reports a changed SHA-256 checksum, restore the already-applied SQL file and add a new higher-sequence migration. Applied migrations are append-only.

## `pnpm modules:check` Fails

Read the human-readable diagnostic and `.tmp/business-module-conformance.json`. Each diagnostic identifies the module, contribution kind, identifier, and cause. Common causes are an identifier outside its permanent Module Code namespace, a broken permission/menu/resource reference, a declared route without matching static registration, an actual Hono/TanStack route without a declaration, or SQLite/PostgreSQL module migration ID mismatch.

Do not fix a mismatch by adding runtime discovery or moving a synthetic fixture into a production registry. Production definitions and API/Web/Worker/database registrations are explicit, and fixture modules belong only under test fixture directories.

## Module Sync Is Pending Or Apply Fails

Run `pnpm modules:sync` against the same database as the API and review `registryHash`, changes, dependency failures, and authorization bindings that will be removed. Missing or disabled dictionary dependencies intentionally block Apply.

Use the exact reviewed hash through `/system/modules` or `pnpm modules:sync --apply --expected-registry-hash=<sha256> --confirmed`. `BUSINESS_MODULE_REGISTRY_STALE` means the compiled release changed after the plan was reviewed; generate a new plan. `MODULE_NOT_SYNCHRONIZED` means the requested module's current activation hash has not been accepted. API startup intentionally does not auto-apply it.

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

SMTP sending is disabled unless `SMTP_ENABLED=true`. When enabled, `SMTP_HOST` and `SMTP_FROM` are required. Use `SMTP_SECURE=true` for implicit TLS; remote non-secure connections must advertise STARTTLS. Plaintext local capture requires loopback plus `SMTP_ALLOW_INSECURE_LOCALHOST=true` outside production.

If Email Deliveries stay pending, confirm both `EMAIL_DELIVERY_ENABLED` and `SMTP_ENABLED` in the Worker. Missing `EMAIL_CONTENT_KEYS` entries intentionally pause affected work without consuming attempts; run `pnpm email:content-keys:migrate` to scan references. Use `scripts/mailpit-dev.ps1` and `pnpm test:smtp-integration` to isolate local transport failures.

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

## Webhook Delivery

- No new deliveries: confirm `WEBHOOK_DELIVERY_ENABLED=true` is set for both API and Worker, the Worker polling interval is nonzero, and the subscription is enabled for the event type.
- Secret creation fails: configure a valid JSON `WEBHOOK_SECRET_KEYS` keyring and matching `WEBHOOK_SECRET_ACTIVE_KEY_ID`. Each value must be canonical Base64 for exactly 32 bytes.
- Existing secrets fail decryption: run `pnpm webhook:secrets:migrate` in scan mode and restore every referenced old key before applying rotation. Delivery fails closed when a key is unavailable.
- Destination is rejected: production requires HTTPS. Private/link-local/loopback/metadata destinations are denied unless an exact private hostname is allowlisted; insecure localhost is development/test only.
- Delivery remains pending: check that the Worker is running. A global disable pauses pending records. Subscription edits increment the revision and cancel old pending records.
- Repeated failures: inspect the Deliveries tab or API attempt detail. `408`, `425`, `429`, `5xx`, network failures, and timeouts retry; other `4xx` and all `3xx` are final.
- Cleanup does not run: verify the scheduled task and `locks` table. The retention handler is a database singleton and skips execution when another Worker owns its lease.
