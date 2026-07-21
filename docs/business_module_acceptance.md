# Business Module Extension Acceptance

Use this checklist before merging changes to the Business Module extension contract or capability runtime.

## Preconditions

- Node.js and pnpm versions match `package.json` and the local development guide.
- PostgreSQL is reachable through `TEST_DATABASE_URL` or `DATABASE_URL`.
- The working tree contains no unreviewed generated artifacts.
- Production API, Web, Worker, definition, and database registries remain empty unless a separately approved real Business Module is being delivered.

## Focused Automated Acceptance

Run:

```bash
pnpm test:business-module-acceptance
```

The command uses synthetic definitions and registrations located only under test directories. It verifies:

- deterministic definition and activation hashes, namespace ownership, references, and fixture isolation;
- Module Sync planning/apply, persisted activation, stale-hash rejection, and removal/disable behavior;
- executable data and field permission compilation for SQLite and PostgreSQL;
- capability declaration/runtime parity and fail-closed behavior;
- Managed File authorization and durable references;
- CSV task persistence, explicit export fields, formula escaping, import validation, and async context;
- Operation Events, Domain Events, Notification Events, controlled Webhook catalog fan-out, and idempotency;
- registered background/scheduled job execution, execution bounds, locking, and inactive-module rejection;
- Hono RPC, Module Registry frontend, and permission-helper integration.

Any skipped PostgreSQL test is a failed acceptance. The runner therefore refuses to start without a PostgreSQL URL.

## Full Quality Gate

After focused acceptance, run:

```bash
pnpm verify
```

This remains the authoritative repository gate and also checks formatting, lint, typechecking, all tests, migrations, local smoke, generated manifests, and production builds.

## Isolation Checks

Confirm:

- `pnpm modules:check` reports zero production Business Modules for the base-system repository.
- Synthetic module codes occur only in `test` or `test/fixtures` paths.
- Generated manifests, OpenAPI, seed data, production menus, and mounted runtime routes contain no synthetic module.
- No SQL Server runtime or migration implementation exists.

## Evidence

Record the audited commit, command results, PostgreSQL version, CI run URL, remaining environment-dependent gaps, and the final decision under `docs/release_readiness_records/`.

Production provider and target-environment acceptance for optional Redis, RabbitMQ, S3-compatible storage, SMTP, and outbound Webhook integrations remain separate deployment evidence.
