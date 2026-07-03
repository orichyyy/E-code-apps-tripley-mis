# Deployment Guide

## Supported v1 Runtime

The v1 backend runtime target is Node.js only. Bun, Deno, and SQL Server deployment code are not included.

## Applications

- Deploy `apps/api` as the Hono API service.
- Deploy `apps/web` as the Vite-built SPA.
- Deploy `apps/worker` separately for durable queue and scheduled-task execution.

## Database

The design supports SQLite for local/demo usage and PostgreSQL for supported deployment. PostgreSQL migration execution uses `DATABASE_URL` or `TEST_DATABASE_URL`. Use `BACKEND_CORE_STORE=database`, `DATABASE_DIALECT=postgresql`, and `DATABASE_URL` for DB-backed backend-core and infrastructure persistence.

Redis, RabbitMQ, S3-compatible storage, SMTP, and webhook delivery integrations remain optional placeholders unless explicitly configured in a future slice.

## Observability

Implemented observability foundation:

- `GET /api/health`
- `GET /api/metrics` placeholder
- `GET /api/openapi.json`
- `x-request-id` propagation
- structured access-log middleware boundary
- alert integration placeholder
