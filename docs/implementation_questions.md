# Implementation Questions

## Backend Core Foundation Blockers

1. **Concrete SQLite driver for local/demo migrations**

   The new goal requires SQLite to remain usable for local development, testing, and demo usage, and requires a `pnpm db:migrate` validation command. The design spec still says the concrete SQLite driver package is intentionally unspecified and must not be chosen silently. Please confirm the SQLite driver package for v1, for example `better-sqlite3`, Node's built-in `node:sqlite`, or another Drizzle-supported SQLite driver.

2. **PostgreSQL integration test database source**

   The new goal requires tests for PostgreSQL only. Please confirm whether integration tests should require an externally provided PostgreSQL URL, such as `TEST_DATABASE_URL`, or whether the repository should introduce a test database provisioning approach. This should be confirmed before adding test infrastructure.

3. **SQLite int64 materialized-path JavaScript mapping**

   The SQLite SQL migration stores organization `path` as `INTEGER`, which is SQLite's signed 64-bit integer storage class. The current Drizzle SQLite TypeScript schema maps it as an integer column without choosing a runtime driver-specific bigint mode. Please confirm whether the selected SQLite driver must preserve this value as `bigint`, or whether repositories should serialize/deserialize the organization path through a driver-specific conversion boundary.
