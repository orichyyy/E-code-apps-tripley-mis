# Release Readiness Record: 2026-07-21 Business Module Extension

## Summary

- Audited capability commit: `165cf07`
- Record date: 2026-07-21
- Environment: local development workstation
- Operating system: Windows
- Node.js: `v22.18.0`
- pnpm: `10.13.1`
- PostgreSQL: `16.14` from Docker `dev-postgres` on `localhost:5432/devdb`
- Scope: Business Module extension foundation Phases 1-4
- Decision: Go for development-baseline merge. Production deployment still requires target-environment acceptance.

Production deployment acceptance remains pending until a target environment is available. It is not a blocker for merging the extension foundation into the development baseline.

## Verification Results

`pnpm verify` passed locally for capability commit `165cf07` and again after the focused acceptance slice on 2026-07-21. The run covered formatting, module conformance, lint, typechecking, the full test suite, SQLite/PostgreSQL migrations, local smoke, generated manifests, and production builds.

`pnpm test:business-module-acceptance` passed locally after the focused acceptance runner and checklist were added. It executed 31 relevant test files with 87 passing tests across contracts, Module SDK, database migrations and permission predicates, API lifecycle/capabilities, Worker execution, and frontend integration.

PostgreSQL tests executed rather than skipping, including:

- module migration execution and checksum/parity coverage;
- PostgreSQL data-permission predicate execution;
- persisted Module Registry lifecycle, reload, update, and disable behavior;
- DB-backed capability reference, CSV context, Outbox, Operation Event, and job persistence.

## Cross-Boundary Acceptance

The synthetic test modules verified:

- Module Sync planning/apply, activation state, stale-hash handling, and retained disabled state;
- static declaration/runtime conformance and production fixture isolation;
- effective data/field permissions and fail-closed behavior;
- Managed File authorization and durable references;
- asynchronous CSV import/export context and idempotency;
- Operation, Domain, and Notification Event publication;
- controlled active-module Webhook event fan-out;
- bounded background/scheduled job handling, locking, and inactive handler rejection;
- Hono RPC inference, Module Registry frontend behavior, and permission helpers.

The acceptance is intentionally composed from fixtures under package/application test directories. No synthetic definition or registration is mounted by production API, Web, Worker, contracts, or database registries.

## Consistency Checks

- `pnpm modules:check`: passed with `0 production modules`.
- Synthetic module scan: matches are confined to test files and test fixture directories.
- Production registries: API, Web, Worker, definition, and database migration registries remain empty.
- SQL Server/MSSQL code scan across `apps`, `packages`, `scripts`, and `.github`: no matches.
- Node.js remains the only backend runtime.
- SQLite remains the local/demo database; PostgreSQL remains the tested deployment database.

## Known Gaps Review

Reviewed `docs/known_gaps.md`. Remaining items are explicit boundaries or optional target-environment work:

- production S3-compatible provider selection and acceptance;
- production SMTP provider/key custody and acceptance;
- production Webhook destination allowlisting/ownership/key custody and acceptance;
- optional Redis and RabbitMQ deployment selection;
- reserved SMS sender and separate DLQ behavior;
- target-environment deployment acceptance.

None is being represented as complete by this record.

## Hosted CI

Pull request: [#2](https://github.com/orichyyy/E-code-apps-tripley-mis/pull/2) on branch `codex/optional-adapter-runtime-wiring`.

Hosted Verify [run 29795805404](https://github.com/orichyyy/E-code-apps-tripley-mis/actions/runs/29795805404) passed for head `0b6d1f6` on 2026-07-21.

The preceding run correctly exposed a clean-install TypeScript resolution gap: `apps/web` directly imports `@web-admin-base/module-sdk`, while its local `paths` override did not include the module SDK source. Adding the explicit source mapping made clean Linux CI consistent with local workspace typechecking; the full local and hosted gates then passed.

## Merge Checklist

- Focused Business Module acceptance passed: yes
- Full local `pnpm verify` passed: yes
- PostgreSQL tests executed: yes
- Production registries remain empty: yes
- No example Business Module was added: yes
- No SQL Server code or migrations were added: yes
- Known gaps reviewed: yes
- Hosted Verify passed: yes
- Target-environment deployment acceptance: pending, not required for development-baseline merge
