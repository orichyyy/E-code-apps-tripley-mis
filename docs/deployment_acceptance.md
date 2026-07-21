# Deployment Acceptance

This runbook verifies a PostgreSQL-backed deployment of the Web Admin Base System after code has already passed CI or `pnpm verify`.

## Scope

This checklist covers the supported v1 deployment shape:

- Node.js runtime only.
- PostgreSQL deployment database.
- API service from `apps/api`.
- Static SPA from `apps/web/dist`.
- Worker service from `apps/worker`.
- Database-backed backend-core, infrastructure, system-management, file, notification, scheduler, and import/export persistence.

It does not require Redis, RabbitMQ, S3-compatible storage, SMS sending, or enabling outbound Webhook delivery. S3-compatible storage and Webhook delivery are implemented but remain optional; production-provider and destination acceptance require the target environment.

## Pre-Deployment Gate

Before deploying, verify the exact commit locally or in CI:

```bash
pnpm install --frozen-lockfile
pnpm verify
```

Expected result:

- Formatting, linting, typechecking, tests, SQLite migrations, PostgreSQL migrations, local smoke, and production build pass.
- No example business module or SQL Server runtime/migration support is present.
- `docs/known_gaps.md` lists any remaining reserved or environment-dependent work.

## Required Production Variables

Set these for API and worker services unless noted otherwise:

```bash
NODE_ENV=production
BACKEND_CORE_STORE=database
DATABASE_DIALECT=postgresql
DATABASE_URL=postgresql://...
JWT_SECRET=<strong-random-secret>
WORKER_POLL_INTERVAL_MS=1000
FILE_STORAGE_ROOT=/shared/web-admin-base/files
FILE_MAX_SIZE_BYTES=52428800
```

Recommended authentication/session variables:

```bash
JWT_ISSUER=web-admin-base
ACCESS_TOKEN_TTL_SECONDS=900
REFRESH_TOKEN_TTL_DAYS=30
AUTH_REFRESH_COOKIE_PATH=/api/auth/refresh
AUTH_REFRESH_COOKIE_SAMESITE=Strict
AUTH_REFRESH_COOKIE_SECURE=true
```

Set `AUTH_REFRESH_COOKIE_DOMAIN` only when the deployment requires a shared cookie domain.

Set seed variables only when initializing a fresh deployment through the seed CLI:

```bash
WEB_ADMIN_SEED_ORGANIZATION_NAME=Default Organization
WEB_ADMIN_SEED_ORGANIZATION_CODE=default
WEB_ADMIN_SEED_ADMIN_USERNAME=admin
WEB_ADMIN_SEED_ADMIN_DISPLAY_NAME=Super Admin
WEB_ADMIN_SEED_ADMIN_EMAIL=admin@example.com
WEB_ADMIN_SEED_ADMIN_PHONE=10000000000
WEB_ADMIN_SEED_ADMIN_PASSWORD=<temporary-initial-password>
```

Optional SMTP variables are only required when SMTP email sending is enabled:

```bash
SMTP_ENABLED=true
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USERNAME=optional-user
SMTP_PASSWORD=optional-password
SMTP_FROM=no-reply@example.com
SMTP_TIMEOUT_MS=10000
EMAIL_DELIVERY_ENABLED=true
EMAIL_CONTENT_KEYS={"primary":"<managed-canonical-base64-key>"}
EMAIL_CONTENT_ACTIVE_KEY_ID=primary
```

## Storage Check

For local filesystem storage, `FILE_STORAGE_ROOT` must point to a writable path.

In multi-server deployments, this path must be a shared mounted directory for every API and worker instance. Local storage writes use a temp-file-then-rename flow for atomic compatibility.

When a target environment explicitly selects S3-compatible storage, record the provider and configure a private, externally provisioned bucket. API and worker must share endpoint, region, bucket, prefix, path-style, and credential-chain settings. Keep `S3_AUTO_CREATE_BUCKET=false` in production. This checklist does not claim that any production provider has been selected or accepted.

```bash
FILE_STORAGE_DRIVER=s3
S3_ENDPOINT=https://provider-endpoint.example
S3_REGION=<provider-region>
S3_BUCKET=<private-preprovisioned-bucket>
S3_OBJECT_PREFIX=web-admin-base/
S3_FORCE_PATH_STYLE=false
S3_AUTO_CREATE_BUCKET=false
S3_PRESIGNED_URL_TTL_SECONDS=60
```

Use `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and optional `S3_SESSION_TOKEN` only when the deployment does not use the AWS SDK default credential chain.

Acceptance checks:

- API process can create files under `FILE_STORAGE_ROOT`.
- Worker process can read and delete invalid or expired files under the same root.
- The path is included in backup/retention planning if uploaded files must be retained.

## Deployment Order

Run from the repository root or equivalent build workspace:

```bash
pnpm install --frozen-lockfile
pnpm db:migrate:postgresql
pnpm build
```

Initialize a fresh database with either the first-start initialization API flow or the seed CLI. For the seed CLI path:

```bash
pnpm --filter @web-admin-base/api seed
```

Start services:

```bash
pnpm --filter @web-admin-base/api start
pnpm --filter @web-admin-base/worker start
```

Serve the SPA:

```text
apps/web/dist
```

The static server must route unknown frontend paths back to `index.html` and proxy or route `/api/*` traffic to the API service.

## Post-Deployment API Checks

Check unauthenticated endpoints:

```text
GET /api/health
GET /api/metrics
GET /api/openapi.json
```

Expected result:

- `/api/health` returns success.
- `/api/metrics` returns the implemented placeholder response.
- `/api/openapi.json` includes implemented backend-core, infrastructure, system-management, communication, file, profile, and SMTP test-send APIs.

Check authentication:

- Open the deployed SPA login page.
- Log in with the initialized administrator.
- If forced password change is required, complete it before continuing.
- Confirm logout clears the authenticated session.

## Post-Deployment Browser Checklist

Shell:

- Sidebar, top bar, breadcrumb, tab navigation, full-screen mode, dark mode, theme color setting, current organization selector, and logout render correctly.
- Current organization selection rejects disabled organizations and refreshes menu/permission context after switching.

Core management:

- User management loads and supports create/edit/status/reset/delete according to permissions.
- Organization management loads and supports create/edit/enable/disable/delete without allowing v1 organization moves.
- Role management loads and supports create/edit/enable/disable/copy/delete, role permission assignment, data permissions, field permissions, and user override surfaces where implemented.
- Permission management loads permission metadata/tree and manifest sync actions.
- Menu management loads menu records and supports create/edit/delete/API bindings.

System and operations:

- System configuration loads existing editable global config records.
- Dictionary management loads dictionary types and items.
- i18n messages load and allow editing existing persisted messages.
- Online users reflects active login sessions.
- Task scheduler lists tasks and supports create/update/enable/disable/manual run.
- Import/export task list shows tasks and can create CSV log export tasks.

Logs:

- Login, operation, access, API call, exception, security, scheduler, and file operation log pages load.
- Log export creates asynchronous CSV export tasks instead of direct synchronous downloads.

Files and notifications:

- File management supports upload, metadata, detail, download, image preview, references, and delete-invalidate behavior.
- Announcements support a paginated management Catalog, system and minimal multi-Organization targets, draft-only edit/delete, publish/unpublish, UTC expiration, and dynamic current-Organization visibility.
- The top-bar Current Announcements panel reloads after Organization switching and never exposes drafts, deleted, expired, or unrelated Announcements.
- Publishing an Announcement creates no recipient snapshots, in-app Notification, email, SMS, or Webhook delivery.
- In-app notifications support unread/read/archive/delete for current-user notifications.
- Notification templates support list/create/edit.
- Webhooks support subscription list/create/edit/enable/disable/delete and safe delivery history. Persisted secrets, full target URLs, payloads, signatures, and response bodies are not displayed.
- Email deliveries expose read-only safe history. Verify remote STARTTLS/implicit TLS, stable Message IDs, retries, final alerts, terminal content purge, and absence of full recipient/content/ciphertext in API, UI, and logs.

Account:

- Personal center loads API-backed profile data.
- Password change works for the current user.
- Personal settings persist language, dark mode, theme color, and tab-navigation preferences.

## Worker Acceptance

Confirm the worker is running with the same database and file-storage configuration as the API service. For local storage this includes `FILE_STORAGE_ROOT`; for S3 it includes all `S3_*` location settings.

Acceptance checks:

- A manual scheduled-task run moves through the durable queue.
- Scheduler execution writes scheduler log entries.
- CSV log export tasks move out of `pending` and produce a result file record.
- In-app notification dispatch jobs create unread notification records for recipients when triggered by implemented internal flows.
- Cleanup tasks do not remove historical file metadata; invalid/deleted file records remain queryable.

If a job does not move, inspect `queue_jobs.status`, `attempt`, `max_attempts`, `next_run_at`, `locked_by`, `locked_at`, and `last_error`.

## Security And Consistency Checks

- API JSON IDs are returned as strings.
- Stored timestamps are UTC.
- Soft-delete flows preserve `is_deleted`, `deleted_at`, and `deleted_by` where lifecycle deletion applies.
- Organization paths still follow the confirmed BIGINT materialized-path design and organization nodes cannot be moved in v1.
- API permission manifest entries exist for implemented private endpoints.
- Hono RPC internal frontend typing remains the frontend API boundary; OpenAPI is documentation.
- Redis, RabbitMQ, S3-compatible storage, SMS sending, and enabled outbound Webhook delivery are not required for base deployment acceptance.
- If S3 is selected, verify private bucket access and authenticated redirect behavior in the target environment before recording provider acceptance.

## Rollback And Troubleshooting Entry Points

Migration failure:

- Confirm `DATABASE_URL` points to PostgreSQL and the database user can create tables/indexes.
- Rerun `pnpm db:migrate:postgresql` after correcting connectivity or privileges.
- See `docs/database_migration_guide.md`.

Login failure:

- Confirm initialization or seed completed.
- Confirm `JWT_SECRET` is stable across API instances.
- Confirm the user, organization, role, and user-organization-role binding are enabled.
- See `docs/troubleshooting_guide.md`.

Worker not consuming:

- Confirm `WORKER_POLL_INTERVAL_MS` is positive.
- Confirm worker and API share the same `DATABASE_URL`.
- Inspect queue and scheduler rows as described in Worker Acceptance.

File access failure:

- Confirm API and worker can read/write `FILE_STORAGE_ROOT`.
- Confirm shared mounted storage is used when more than one server handles files.
- Confirm uploaded file extensions match the whitelist.

OpenAPI or permission inconsistency:

- Run the contracts and API tests.
- Confirm route/API permission manifests were generated from the current build.
- Confirm permission sync was run where needed.

## Optional Webhook Acceptance

Perform this section only when outbound delivery is selected for the target environment:

1. Confirm API and Worker use identical `WEBHOOK_*` configuration and `WEBHOOK_ALLOW_INSECURE_LOCALHOST=false`.
2. Run the secret migration in scan mode, restore required old keys, then apply and rescan.
3. Verify the selected HTTPS destination is authorized and does not require redirects.
4. Trigger one controlled event and confirm the receiver validates the HMAC signature and deduplicates by CloudEvent ID.
5. Exercise a retryable response and a final `4xx`; confirm durable attempts, bounded retry timing, and final alert-boundary invocation.
6. Confirm logs and APIs do not expose full URLs, query strings, bodies, signatures, secrets, or ciphertext.
7. Record the destination owner, allowlisted private hostnames, key IDs, and rollback procedure without recording key material.

## Acceptance Evidence

Record:

- Commit hash and deployment artifact version.
- Deployment date and environment name.
- Node.js and pnpm versions.
- PostgreSQL version.
- API, web, and worker process versions.
- `pnpm db:migrate:postgresql` result.
- Initialization method: first-start wizard or seed CLI.
- Post-deployment API and browser checklist results.
- Worker acceptance results.
- Deviations linked to `docs/known_gaps.md`.
