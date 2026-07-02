# Troubleshooting Guide

## `pnpm db:migrate` Fails

Expected current behavior:

```text
Database migration execution ... is blocked until the SQLite driver and PostgreSQL test/provisioning strategy are confirmed
```

See `docs/implementation_questions.md` and `docs/known_gaps.md`.

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
