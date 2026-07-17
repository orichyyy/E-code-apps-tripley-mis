# Deployment Guide

## Supported v1 Runtime

The v1 backend runtime target is Node.js only. Bun, Deno, and SQL Server deployment code are not included.

## Applications

- Deploy `apps/api` as the Hono API service.
- Deploy `apps/web` as the Vite-built SPA.
- Deploy `apps/worker` separately for durable queue and scheduled-task execution. Configure `WORKER_POLL_INTERVAL_MS` with a positive value for continuous polling. Queue retry state, stale-running recovery, scheduled-task cron `next_run_at`, and scheduler execution logs are stored in the deployment database. The default worker catalog processes confirmed base tasks: in-app notification dispatch, manual `scheduled.run`, log retention cleanup, local invalid-file cleanup, CSV log export tasks, and import/export result cleanup.

## Database

The design supports SQLite for local/demo usage and PostgreSQL for supported deployment. PostgreSQL migration execution uses `DATABASE_URL` or `TEST_DATABASE_URL`. Use `BACKEND_CORE_STORE=database`, `DATABASE_DIALECT=postgresql`, and `DATABASE_URL` for DB-backed backend-core and infrastructure persistence.

The worker uses `DATABASE_DIALECT` and `DATABASE_URL` to create database-backed queue and scheduler adapters. In production, run migrations before starting both API and worker processes.

Minimal deployment order:

```bash
pnpm install --frozen-lockfile
pnpm db:migrate:postgresql
pnpm build
pnpm --filter @web-admin-base/api start
pnpm --filter @web-admin-base/worker start
```

Serve the built SPA from `apps/web/dist` with the deployment platform or a static web server.

Required production environment variables include `BACKEND_CORE_STORE=database`, `DATABASE_DIALECT=postgresql`, `DATABASE_URL`, `JWT_SECRET`, and a positive `WORKER_POLL_INTERVAL_MS` for continuous worker polling.

Local filesystem storage remains the default through `FILE_STORAGE_ROOT`; multi-server local deployments require a shared mounted directory. Optional S3-compatible storage is selected with `FILE_STORAGE_DRIVER=s3` and uses private buckets, backend authorization, and short-lived presigned redirects. API and worker must receive identical S3 location settings. Production buckets are provisioned externally, so `S3_AUTO_CREATE_BUCKET` must remain false in production.

SMTP email sending and outbound Webhook delivery are optional and disabled by default. Redis, RabbitMQ, and S3-compatible storage are also optional runtime integrations.

Reliable email requires identical `EMAIL_DELIVERY_*`, `EMAIL_CONTENT_KEYS`, and active-key configuration in API and Worker. Remote SMTP must use implicit TLS or advertise STARTTLS; the loopback plaintext exception is forbidden in production. Scan content-key references before rotation. Production SMTP provider selection, credential/key custody, alert routing, and target-environment acceptance remain deployment decisions.

Outbound Webhook delivery requires identical `WEBHOOK_*` configuration in API and Worker. Production destinations require HTTPS. Keep `WEBHOOK_ALLOW_INSECURE_LOCALHOST=false`; allow private destinations only by exact hostname through `WEBHOOK_ALLOWED_HOSTS`. Provide a versioned AES-256-GCM keyring through `WEBHOOK_SECRET_KEYS` and an active key ID. Run the secret migration in scan mode before `--apply`, then start API before Worker. Pending work pauses when delivery is disabled.

S3 runtime variables are `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_OBJECT_PREFIX`, `S3_FORCE_PATH_STYLE`, `S3_PRESIGNED_URL_TTL_SECONDS`, and optional explicit credential variables. The TTL is restricted to 15-900 seconds. The AWS SDK default credential chain is used when explicit credentials are omitted. A production object-storage provider has not been selected or accepted by this repository.

Use `docs/deployment_acceptance.md` for the deployment pre-checks, production environment checklist, post-deployment browser walkthrough, worker acceptance checks, and rollback/troubleshooting entry points.

## Observability

Implemented observability foundation:

- `GET /api/health`
- `GET /api/metrics` placeholder
- `GET /api/openapi.json`
- `x-request-id` propagation
- structured access-log middleware boundary
- alert integration placeholder
