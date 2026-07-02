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

## Request ID Issues

The API accepts valid incoming `x-request-id`, generates one when absent, returns it in response headers, and includes it in structured access-log entries.
