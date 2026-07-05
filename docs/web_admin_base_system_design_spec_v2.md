# Web Admin Base System — System Design Specification v2

**Document Type:** Detailed System Design Specification for Codex implementation  
**Product:** Web Admin Base System  
**Based On:** `web_admin_base_system_prd.md` v1.0 and subsequent requirement clarifications  
**Supersedes:** `web_admin_base_system_design_spec.md` v1.0  
**Scope:** Base system only. No sample business module.  
**Language:** English  
**Version:** v2.0  
**Date:** 2026-07-01

---

## 0. Non-Negotiable Implementation Rules for Codex

Codex must implement only the requirements explicitly confirmed in this specification.

1. **Do not implement a sample business module.**
2. **Do not use TypeORM.** The ORM requirement is **Drizzle ORM**.
3. **Do not assume SQL Server support in v1.** SQL Server is a **v2 target** and must not introduce v1 implementation code.
4. **Do not assume backend runtime portability.** v1 targets **Node.js only**.
5. **Do not silently choose unspecified concrete infrastructure.** Where this spec intentionally defines an abstraction without a concrete driver detail, implement the abstraction and mark the concrete implementation as a configuration/extension point.
6. **Do not change confirmed frontend choices.** Use React, shadcn/ui, Tailwind CSS, Zustand, TanStack Router, TanStack Form, and TanStack Query according to the boundaries defined below.
7. **Do not implement online user kick-out in v1.** Only viewing online users is required; kick-out is reserved.
8. **Do not implement self-service password recovery in v1.** Administrator reset is required.
9. **Do not implement MFA/2FA, SSO, tenant management UI/API, position management, SMS sending, or Excel import/export in v1.** These are reserved only.
10. **Do not use `/api/v1` in v1 routes.** v1 uses `/api`; the design must allow a future `/api/v2`.

---

## 1. Codex Execution Brief

Build a reusable multi-organization web admin base system with the following deployable applications and shared packages:

```text
web-admin-base/
  apps/
    api/        # Hono API server, Node.js target
    web/        # React Vite admin frontend
    worker/     # Background worker for queue jobs, scheduler, async import/export, async logs
  packages/
    shared/     # Shared constants, types, utilities, i18n keys
    db/         # Drizzle schema, dialect-specific migrations, database connection adapters
    contracts/  # API schemas, OpenAPI generation, Hono RPC type exports, route/permission manifests
    adapters/   # Infrastructure adapter interfaces and driver implementations
```

The first version must implement the base platform capabilities:

- Authentication, refresh-token session tracking, logout, password policies
- User management
- Organization management
- Role, permission, menu, route, API, data, and field permission management
- System configuration
- Dictionary management
- File upload and file management
- Announcements, in-app notifications, email notifications, webhook notifications, SMS abstraction only
- Logs and audit: login, operation, access, API, exception, security, job, file operation
- Scheduled tasks
- Generic CSV import/export framework
- Internationalization
- Personal center
- Online user viewing
- Initialization wizard and seed scripts
- Observability foundation
- Business module extension specification

---

## 2. Confirmed Technology Stack

| Area                             | Confirmed Decision                                                                |
| -------------------------------- | --------------------------------------------------------------------------------- |
| Language                         | TypeScript across frontend, backend, worker, and shared packages                  |
| Package manager                  | pnpm                                                                              |
| Repository style                 | Monorepo                                                                          |
| Frontend app                     | React + Vite SPA                                                                  |
| UI                               | shadcn/ui + Tailwind CSS                                                          |
| Frontend routing                 | TanStack Router                                                                   |
| Frontend route style             | TanStack Router file routes + separate business route metadata                    |
| Frontend forms                   | TanStack Form + Zod                                                               |
| Frontend global state            | Zustand for UI/auth/current organization context                                  |
| Frontend server state            | TanStack Query                                                                    |
| Backend framework                | Hono                                                                              |
| Backend runtime                  | Node.js only for v1                                                               |
| ORM                              | Drizzle ORM                                                                       |
| v1 local database                | SQLite for local development, testing, and demo usage                             |
| v1 supported deployment database | PostgreSQL                                                                        |
| v2 database target               | SQL Server; v1 must not implement SQL Server code                                 |
| Database schema strategy         | One common Drizzle schema definition where possible                               |
| Migration strategy               | Independent migration files per dialect                                           |
| API base path                    | `/api` in v1; future `/api/v2` must be possible                                   |
| Internal API client              | Hono RPC type inference for frontend/internal usage                               |
| API documentation                | OpenAPI generated from Hono routes + Zod schemas                                  |
| Queue drivers                    | In-memory queue, database queue, MQ adapter, RabbitMQ driver                      |
| Event bus drivers                | In-process event bus, database outbox, MQ adapter/RabbitMQ-compatible integration |
| Cache drivers                    | In-memory, Redis, database                                                        |
| Lock drivers                     | In-memory lock and database lock abstraction                                      |
| Rate limit drivers               | In-memory, Redis, database                                                        |
| File storage drivers             | Local shared directory storage and S3-compatible object storage                   |
| Notification channels            | SMTP email, webhook; SMS abstraction reserved only                                |

### 2.1 Explicitly Not Specified by Requirement

The following are intentionally not fixed by the user and must not be guessed silently:

| Item                             | Required Handling                                                                                                       |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Concrete SQLite driver package   | Must be behind the database adapter. The spec does not mandate `better-sqlite3`, `node:sqlite`, or `libsql`.            |
| Database lock internal algorithm | Must be behind `LockAdapter`. The spec does not mandate advisory locks, lease table semantics, or dialect-specific SQL. |
| SQL Server Drizzle strategy      | v1 must not introduce SQL Server code. Re-evaluate in v2.                                                               |

Codex may still implement all interfaces, module boundaries, configuration keys, tests for interfaces, and non-conflicting concrete drivers.

---

## 3. Version Scope

### 3.1 Version 1 In Scope

1. SQLite support for local development, automated local testing, and demo deployment.
2. PostgreSQL support for supported deployment.
3. Node.js API server.
4. Worker application.
5. All base admin modules from the PRD.
6. Abstract infrastructure adapters for cache, lock, queue, event bus, rate limiting, token store, scheduler, file storage, and notification channels.
7. Concrete adapter drivers confirmed for v1, except where explicitly left unspecified.
8. Business module extension contracts without a sample business module.

### 3.2 Version 1 Out of Scope

1. SQL Server implementation.
2. SQL Server migrations.
3. SQL Server schema package or code skeletons.
4. Backend runtime compatibility with Bun or Deno.
5. Sample asset module or any other example module.
6. Excel import/export implementation.
7. MFA/2FA implementation.
8. SSO implementation.
9. Tenant management UI/API.
10. Position/job management implementation.
11. SMS sending implementation.
12. Online user kick-out.
13. Full mobile/tablet responsive optimization.
14. Self-service password recovery.

### 3.3 Version 2 Reserved Scope

1. SQL Server support.
2. SQL Server-specific migration files.
3. Evaluation of Drizzle SQL Server support at the time v2 is planned.
4. Optional `/api/v2` route namespace.
5. Excel import/export.
6. Optional online user kick-out.
7. Optional SSO/MFA/SMS concrete providers.

---

## 4. High-Level Architecture

```text
Browser
  |
  | HTTPS
  v
apps/web --------------> apps/api --------------------+
React Vite SPA           Hono API                     |
TanStack Router          Auth/RBAC/Modules            |
TanStack Query           Adapter factories            |
Zustand                                                |
                                                         v
                                                   packages/db
                                                   Drizzle schema
                                                   SQLite/PostgreSQL connections

apps/worker ------------------------------------------+
Queue jobs, schedulers, async logs, import/export

packages/contracts
API schemas, Hono RPC exports, OpenAPI generator,
route manifest, permission manifest

packages/adapters
CacheAdapter, LockAdapter, QueueAdapter, EventBusAdapter,
RateLimitAdapter, TokenStoreAdapter, JobSchedulerAdapter,
FileStorageAdapter, NotificationChannelAdapter
```

### 4.1 API Service Statefulness

The API service may be stateful in single-machine mode. In multi-machine mode, it must use configured adapters for shared state.

| Deployment Mode                    | Requirement                                                                                                                 |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Single machine, single process     | In-memory adapters may be used for cache, queue, lock, and rate limit.                                                      |
| Single machine, multiple processes | Prefer database or Redis-backed adapters for shared coordination.                                                           |
| Multiple servers + load balancer   | API must be effectively stateless; shared state must use DB, Redis, object storage, RabbitMQ, or other configured adapters. |
| Containerized deployment           | All persistent state must be externalized or mounted as configured volumes.                                                 |

### 4.2 Supported Deployment Modes

v1 must support:

1. Single-machine single-process deployment.
2. Single-machine multi-process deployment.
3. Multi-server deployment behind a load balancer.
4. Containerized deployment.

Kubernetes and serverless/edge deployment are not required in v1.

---

## 5. Repository Structure

```text
web-admin-base/
  apps/
    api/
      src/
        main.ts
        app.ts
        config/
        core/
        infra/
        modules/
        middleware/
        observability/
        openapi/
      test/
      package.json
    worker/
      src/
        main.ts
        config/
        runners/
        jobs/
        schedulers/
      test/
      package.json
    web/
      src/
        main.tsx
        app/
        routes/
        route-metadata/
        components/
        features/
        stores/
        queries/
        forms/
        i18n/
        lib/
      test/
      package.json
  packages/
    shared/
      src/
        constants/
        types/
        utils/
        i18n/
      package.json
    db/
      src/
        schema/
        migrations/
          sqlite/
          postgresql/
        connection/
        dialects/
        seeds/
      package.json
    contracts/
      src/
        api-schemas/
        hono-rpc/
        openapi/
        permissions/
        routes/
        manifests/
      package.json
    adapters/
      src/
        cache/
        lock/
        queue/
        event-bus/
        rate-limit/
        token-store/
        scheduler/
        storage/
        notification/
      package.json
  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
  eslint.config.*
  .env.example
```

### 5.1 Package Responsibilities

| Package/App          | Responsibility                                                                                            |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| `apps/api`           | Hono HTTP API, middleware, module routes, services, repositories, policy enforcement.                     |
| `apps/worker`        | Queue consumers, scheduled jobs, async logs, import/export jobs.                                          |
| `apps/web`           | React admin interface.                                                                                    |
| `packages/db`        | Drizzle schema, migrations, database connection factory, seeds.                                           |
| `packages/contracts` | Zod schemas, OpenAPI generation, Hono RPC types, route metadata contracts, permission manifest contracts. |
| `packages/adapters`  | Adapter interfaces and driver implementations.                                                            |
| `packages/shared`    | Cross-cutting constants, utility types, non-infrastructure helpers.                                       |

---

## 6. Backend Architecture

### 6.1 Module Structure

Use feature-module aggregation for system modules, plus `core` and `infra` directories.

```text
apps/api/src/
  core/
    errors/
    result/
    pagination/
    auth-context/
    permission-engine/
    data-scope-engine/
    field-policy-engine/
  infra/
    db/
    adapters/
    logging/
    config/
    security/
  modules/
    auth/
      auth.routes.ts
      auth.service.ts
      auth.repository.ts
      auth.schemas.ts
      auth.permissions.ts
    users/
      users.routes.ts
      users.service.ts
      users.repository.ts
      users.schemas.ts
      users.permissions.ts
    organizations/
    roles/
    permissions/
    menus/
    system-config/
    dictionaries/
    files/
    notifications/
    announcements/
    logs/
    jobs/
    import-export/
    i18n/
    observability/
    initialization/
```

### 6.2 Route-Service-Repository Pattern

Each resource-oriented module must follow this pattern:

| Layer               | Responsibility                                                                      |
| ------------------- | ----------------------------------------------------------------------------------- |
| Route               | Hono route definitions, request validation, response serialization, route metadata. |
| Service             | Business rules, permission checks, transaction orchestration.                       |
| Repository          | Drizzle queries and persistence logic.                                              |
| Schema              | Zod request/response schemas.                                                       |
| Permission manifest | Permission codes used by routes and menu/actions.                                   |

### 6.3 Dependency Strategy

No full dependency injection framework is required in v1. Modules may import services and repositories directly.

Adapters must be created through explicit factories:

```ts
const cache = createCacheAdapter(config.cache);
const queue = createQueueAdapter(config.queue);
const storage = createFileStorageAdapter(config.storage);
```

Do not introduce a DI framework unless a future requirement explicitly approves it.

### 6.4 Configuration Management

Use `.env` plus typed configuration files.

```text
apps/api/src/config/
  default.ts
  development.ts
  test.ts
  demo.ts
  production.ts
  load-config.ts
```

Required behavior:

1. Environment variables and config files are both supported.
2. Environment variables override config file values.
3. Startup validates the merged configuration.
4. Invalid configuration must fail fast with a structured error.

Implementation may use Zod for configuration validation.

---

## 7. Database Architecture

### 7.1 Database Support Matrix

| Database   | v1 Role                                      | Notes                                                                                    |
| ---------- | -------------------------------------------- | ---------------------------------------------------------------------------------------- |
| SQLite     | Local development, local testing, demo usage | Driver package is not fixed by this spec. Must be behind database adapter.               |
| PostgreSQL | Supported deployment database                | Integration tests target PostgreSQL.                                                     |
| SQL Server | v2 target                                    | No v1 SQL Server code, schema, or migration skeleton. Re-evaluate Drizzle support in v2. |

### 7.2 ORM

Use Drizzle ORM.

Required organization:

```text
packages/db/src/
  schema/
    index.ts
    users.ts
    organizations.ts
    auth.ts
    permissions.ts
    menus.ts
    files.ts
    notifications.ts
    logs.ts
    jobs.ts
    import-export.ts
    system.ts
  migrations/
    sqlite/
    postgresql/
  connection/
    create-db.ts
    sqlite.ts
    postgresql.ts
  dialects/
    types.ts
```

### 7.3 Schema Strategy

Use one common schema definition where possible. Database-specific differences are handled in dialect adapters and migration files.

Allowed differences between SQLite and PostgreSQL:

1. Boolean representation.
2. Timestamp representation.
3. JSON representation.
4. Index syntax.
5. Constraint syntax.
6. Default expression syntax.

Business fields must remain consistent across dialects.

### 7.4 Migration Strategy

Maintain independent migration files per dialect.

```text
packages/db/src/migrations/sqlite/
packages/db/src/migrations/postgresql/
```

Migration workflow:

1. Update common schema.
2. Generate or write SQLite migration.
3. Generate or write PostgreSQL migration.
4. Review both migrations manually.
5. Commit both migration sets.
6. Run migration smoke checks locally.

Do not create SQL Server migration files in v1.

### 7.5 ID Strategy

Use database auto-increment IDs.

API serialization rule:

- All IDs returned in JSON must be strings.
- All ID inputs from frontend/API clients must be accepted as strings and validated as integer strings.
- Backend may convert to `number` or `bigint` internally according to database driver behavior.

Example:

```json
{
  "id": "123",
  "organizationId": "45"
}
```

### 7.6 Time Strategy

All persistent timestamps must be stored in UTC. The frontend displays timestamps according to user language/timezone settings where applicable.

Required standard fields:

```text
created_at UTC
updated_at UTC
deleted_at UTC nullable where deletion audit is required
```

### 7.7 Soft Delete Strategy

Use:

```text
is_deleted boolean/integer flag
deleted_at nullable UTC timestamp
deleted_by nullable user ID
```

Repository queries must exclude deleted records by default.

Hard delete is allowed only for:

1. Temporary queue rows after retention cleanup.
2. Expired cache rows.
3. Temporary import/export artifacts after retention cleanup.
4. Other internal cleanup tables explicitly designed as ephemeral.

### 7.8 Tenant Field Reservation

The system is not SaaS multi-tenant in v1. However, core business-relevant tables must reserve:

```text
tenant_id nullable
```

Rules:

1. Do not expose tenant management UI/API in v1.
2. Do not enforce tenant isolation in v1.
3. Keep `tenant_id` nullable.
4. Future tenant support must not require rewriting all core tables.

---

## 8. Organization Tree Design

### 8.1 Confirmed Business Constraints

1. Organization is the unified term for former branch/department concept.
2. Organization tree supports multiple root nodes.
3. System initialization creates one default root organization.
4. Maximum business depth is **8 levels**.
5. Maximum sibling count per level is **255**.
6. Top-level segment is restricted to **1–127** because materialized path is stored as signed int64.
7. Organization movement is **not allowed** in v1.
8. `parent_id` is **not stored**.
9. Organization disablement cascades automatically to descendants.

### 8.2 Materialized Path Encoding

Use materialized path stored as signed int64.

- Total path size: 64 bits.
- Each level uses 8 bits.
- Maximum levels: 8.
- Segment value `0` means unused level.
- Level 1 segment range: `1–127`.
- Level 2–8 segment range: `1–255`.

Example conceptual encoding:

```text
Level segments: [1, 5, 20, 0, 0, 0, 0, 0]
Binary bytes:    01 05 14 00 00 00 00 00
Stored as signed BIGINT/int64.
```

### 8.3 Organization Fields

| Field           | Required | Notes                                           |
| --------------- | -------: | ----------------------------------------------- |
| id              |      Yes | Auto-increment ID, serialized as string in API. |
| tenant_id       | Reserved | Nullable.                                       |
| path            |      Yes | Signed int64 materialized path.                 |
| level           |      Yes | 1–8.                                            |
| segment         |      Yes | Segment at current level.                       |
| name            |      Yes | Organization name.                              |
| code            |      Yes | Organization code.                              |
| manager_user_id |       No | Responsible person.                             |
| phone           |       No | Contact phone.                                  |
| email           |       No | Contact email.                                  |
| address         |       No | Address.                                        |
| sort_order      |      Yes | Display ordering. Not equal to path segment.    |
| status          |      Yes | enabled / disabled.                             |
| remark          |       No | Free text.                                      |
| is_deleted      |      Yes | Soft-delete flag.                               |
| deleted_at      |       No | UTC.                                            |
| deleted_by      |       No | User ID.                                        |
| created_at      |      Yes | UTC.                                            |
| updated_at      |      Yes | UTC.                                            |
| created_by      |       No | User ID.                                        |
| updated_by      |       No | User ID.                                        |

### 8.4 Segment Allocation

The system automatically finds the next available sibling segment. The segment is not controlled by `sort_order` and not manually edited by administrators.

Required behavior:

1. When creating a root organization, allocate a top-level segment from `1–127`.
2. When creating a child organization, allocate a segment from `1–255` among siblings under the same prefix.
3. If the sibling segment range is exhausted, return a business error.
4. Since moving is not allowed, allocated path values are stable.

### 8.5 Descendant Query

Descendant checks use path prefix semantics. The implementation must provide reusable helper functions:

```ts
encodeOrgPath(segments: number[]): bigint;
decodeOrgPath(path: bigint): number[];
getOrgPathRange(path: bigint, level: number): { min: bigint; max: bigint };
isDescendantPath(candidate: bigint, ancestor: bigint, ancestorLevel: number): boolean;
```

The exact SQL expression may differ by database dialect and must be implemented in the database repository layer.

### 8.6 Disable Rules

Confirmed rules:

1. A disabled organization cannot be switched to as the current organization.
2. Disabling an organization automatically disables all descendants.
3. Users assigned to a disabled organization may still log in if they have another enabled organization.
4. Historical data under disabled organizations is retained and queryable.
5. New business data must not be created under disabled organizations.
6. Re-enabling behavior must be implemented carefully: re-enabling a parent must not automatically re-enable descendants unless explicitly selected in the UI. If no UI choice is provided, require administrators to re-enable descendants separately.

---

## 9. Infrastructure Adapter Architecture

### 9.1 Adapter Package Structure

```text
packages/adapters/src/
  cache/
    cache.adapter.ts
    memory-cache.adapter.ts
    redis-cache.adapter.ts
    db-cache.adapter.ts
  lock/
    lock.adapter.ts
    memory-lock.adapter.ts
    db-lock.adapter.ts
  queue/
    queue.adapter.ts
    memory-queue.adapter.ts
    db-queue.adapter.ts
    rabbitmq-queue.adapter.ts
  event-bus/
    event-bus.adapter.ts
    in-process-event-bus.adapter.ts
    db-outbox-event-bus.adapter.ts
    rabbitmq-event-bus.adapter.ts
  rate-limit/
    rate-limit.adapter.ts
    memory-rate-limit.adapter.ts
    redis-rate-limit.adapter.ts
    db-rate-limit.adapter.ts
  token-store/
    token-store.adapter.ts
    db-token-store.adapter.ts
    redis-token-store.adapter.ts
    memory-token-store.adapter.ts
  scheduler/
    scheduler.adapter.ts
  storage/
    file-storage.adapter.ts
    local-storage.adapter.ts
    s3-storage.adapter.ts
  notification/
    notification-channel.adapter.ts
    smtp-notification.adapter.ts
    webhook-notification.adapter.ts
    sms-notification.placeholder.ts
```

### 9.2 Adapter Matrix

| Capability           | Interface Required | v1 Drivers                                                      |
| -------------------- | -----------------: | --------------------------------------------------------------- |
| Cache                |                Yes | in-memory, Redis, database                                      |
| Lock                 |                Yes | in-memory, database abstraction                                 |
| Queue                |                Yes | in-memory, database, RabbitMQ                                   |
| Event Bus            |                Yes | in-process, database outbox, RabbitMQ-compatible MQ integration |
| Rate Limit           |                Yes | in-memory, Redis, database                                      |
| Session/Token Store  |                Yes | in-memory, database, Redis                                      |
| Job Scheduler        |                Yes | worker-based scheduler using configured lock/queue strategy     |
| File Storage         |                Yes | local shared directory, S3-compatible storage                   |
| Notification Channel |                Yes | SMTP email, webhook, SMS placeholder only                       |

### 9.3 Cache Adapter

```ts
export interface CacheAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options?: { ttlSeconds?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  deleteByPrefix(prefix: string): Promise<void>;
}
```

Usage:

1. Permission cache.
2. Route/menu metadata cache.
3. System configuration cache.
4. Dictionary cache.
5. Rate-limit implementation may use a separate adapter.

### 9.4 Lock Adapter

```ts
export interface LockAdapter {
  acquire(input: {
    key: string;
    ownerId: string;
    ttlMs: number;
  }): Promise<{ acquired: boolean; fencingToken?: string }>;

  release(input: { key: string; ownerId: string; fencingToken?: string }): Promise<void>;

  extend?(input: {
    key: string;
    ownerId: string;
    ttlMs: number;
    fencingToken?: string;
  }): Promise<boolean>;
}
```

Important:

- The database lock internal algorithm is intentionally not fixed by the requirement.
- Implement the interface and integration points.
- Do not hard-code PostgreSQL advisory locks, SQLite table-lock behavior, or a specific lease-table algorithm unless separately approved.

### 9.5 Queue Adapter

The database queue first version has simple semantics only:

```text
pending
running
succeeded
failed
```

Delayed jobs, retry policy, and dead-letter semantics are reserved but must be considered in schema fields where practical.

```ts
export interface QueueAdapter {
  enqueue<TPayload>(input: {
    queueName: string;
    jobType: string;
    payload: TPayload;
    runAfter?: Date;
    priority?: number;
    dedupeKey?: string;
  }): Promise<{ jobId: string }>;

  claim(input: {
    queueName: string;
    workerId: string;
    maxJobs: number;
    visibilityTimeoutSeconds: number;
  }): Promise<ClaimedJob[]>;

  complete(jobId: string, result?: unknown): Promise<void>;
  fail(jobId: string, error: QueueJobError, options?: { retry?: boolean }): Promise<void>;
}
```

v1 drivers:

1. In-memory queue for single-process development.
2. Database queue for shared deployment without external MQ.
3. RabbitMQ queue driver for MQ-based deployment.

### 9.6 Event Bus Adapter

```ts
export interface EventBusAdapter {
  publish<TPayload>(event: {
    type: string;
    payload: TPayload;
    aggregateType?: string;
    aggregateId?: string;
    occurredAt: Date;
  }): Promise<void>;

  subscribe<TPayload>(eventType: string, handler: EventHandler<TPayload>): Promise<Unsubscribe>;
}
```

v1 drivers:

1. In-process event bus.
2. Database outbox event bus.
3. RabbitMQ-compatible MQ integration.

### 9.7 Rate Limit Adapter

```ts
export interface RateLimitAdapter {
  hit(input: {
    key: string;
    limit: number;
    windowSeconds: number;
  }): Promise<{ allowed: boolean; remaining: number; resetAt: Date }>;
}
```

v1 drivers:

1. In-memory.
2. Redis.
3. Database.

### 9.8 Token Store Adapter

```ts
export interface TokenStoreAdapter {
  createSession(input: CreateSessionInput): Promise<LoginSession>;
  getSession(sessionId: string): Promise<LoginSession | null>;
  revokeSession(sessionId: string, reason: string): Promise<void>;
  revokeUserSessions(userId: string, reason: string): Promise<void>;
  updateActivity(sessionId: string, at: Date): Promise<void>;
}
```

Required drivers:

1. Database.
2. Redis.
3. In-memory for local/demo usage.

### 9.9 File Storage Adapter

```ts
export interface FileStorageAdapter {
  putObject(input: PutObjectInput): Promise<StoredObject>;
  getObject(input: GetObjectInput): Promise<ReadableStream | NodeJS.ReadableStream>;
  deleteObject(input: DeleteObjectInput): Promise<void>;
  createDownloadUrl(input: CreateDownloadUrlInput): Promise<{ url: string; expiresAt?: Date }>;
}
```

Local shared directory rules:

1. Multi-server deployment may use a shared mounted directory.
2. Writes must use temporary-file-then-rename to improve atomicity.
3. Multi-server deployments are recommended to use S3-compatible storage; shared local directory is a compatibility mode.

### 9.10 Notification Channel Adapter

```ts
export interface NotificationChannelAdapter {
  send(input: NotificationSendInput): Promise<NotificationSendResult>;
}
```

v1 concrete channels:

1. SMTP email.
2. Webhook.
3. SMS placeholder interface only. Do not implement a real SMS provider in v1.

Webhook must support both:

1. Notification sending channel.
2. System event subscription mechanism.

---

## 10. Worker and Distributed Task Design

### 10.1 Worker Application

`apps/worker` is required in v1.

Responsibilities:

1. Consume queue jobs.
2. Run scheduled tasks.
3. Write async logs.
4. Execute async import/export.
5. Process notification dispatch.
6. Process database outbox events.

### 10.2 Task Execution Types

Tasks must support different execution semantics.

| Task Type                 | Example                                                                | Execution Rule                                                                                   |
| ------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Per-node maintenance task | Clean local temp files, clean node-local artifacts                     | Each server may run one worker and execute the task locally. No cluster singleton lock required. |
| Cluster singleton task    | Business logic task, global data cleanup, scheduled notification batch | Each worker instance attempts to acquire configured distributed lock; only one executes.         |
| Queue job task            | Import/export, async logging, notification sending                     | Workers claim jobs from configured queue adapter.                                                |

### 10.3 Scheduler Model

Each server may run one worker. The worker loads enabled schedules and dispatches according to `execution_scope`.

Suggested task fields:

| Field           | Notes                                            |
| --------------- | ------------------------------------------------ |
| id              | ID string in API.                                |
| code            | Unique task code.                                |
| name            | Display name.                                    |
| cron_expression | Cron schedule.                                   |
| status          | enabled / disabled.                              |
| execution_scope | `per_node`, `cluster_singleton`, or `queue_job`. |
| lock_key        | Required for cluster singleton tasks.            |
| timeout_seconds | Execution timeout.                               |
| retry_enabled   | Whether retry is enabled.                        |
| retry_limit     | Retry count.                                     |
| parameters_json | Task parameters.                                 |
| last_run_at     | Last execution time.                             |
| next_run_at     | Next planned time.                               |

### 10.4 Queue Job Table

Database queue may use a table shaped as follows:

| Field         | Notes                             |
| ------------- | --------------------------------- |
| id            | Auto-increment.                   |
| queue_name    | Queue partition.                  |
| job_type      | Handler key.                      |
| payload_json  | Job payload.                      |
| status        | pending/running/succeeded/failed. |
| priority      | Optional.                         |
| run_after     | Optional scheduling time.         |
| attempt_count | Retry bookkeeping.                |
| max_attempts  | Reserved.                         |
| locked_by     | Worker ID.                        |
| locked_until  | Visibility timeout.               |
| error_json    | Last error.                       |
| result_json   | Optional result.                  |
| created_at    | UTC.                              |
| updated_at    | UTC.                              |

Delayed jobs, retry, and dead-letter behavior are reserved but not required to be fully implemented beyond the simple status model.

---

## 11. Authentication, Token, Session, and Security

### 11.1 Login Method

v1 supports:

1. Username + password.
2. SSO extension reservation only.

### 11.2 Token Strategy

Use JWT Access Token + Refresh Token.

Confirmed frontend storage:

| Token         | Storage         |
| ------------- | --------------- |
| Access Token  | `localStorage`  |
| Refresh Token | HttpOnly Cookie |

Security requirement:

- The spec must explicitly document XSS risk because access token is stored in `localStorage`.
- Frontend must avoid unsafe HTML injection.
- Content Security Policy should be supported by deployment configuration.
- Sensitive tokens must never be logged.

### 11.3 Refresh Token Cookie

SameSite policy is deployment-configurable.

Required config:

```text
AUTH_REFRESH_COOKIE_SAMESITE=Strict|Lax|None
AUTH_REFRESH_COOKIE_SECURE=true|false
AUTH_REFRESH_COOKIE_DOMAIN=
AUTH_REFRESH_COOKIE_PATH=/api/auth/refresh
```

### 11.4 CSRF Protection

CSRF protection is required because refresh token uses Cookie.

Minimum required protection:

1. Refresh endpoint validates CSRF token or equivalent anti-CSRF mechanism.
2. Logout endpoint validates CSRF token or equivalent anti-CSRF mechanism.
3. Cookie-related auth endpoints must not accept unsafe cross-site requests without CSRF validation.

### 11.5 Refresh Token Rotation

Refresh token rotation is not implemented in v1. It is reserved for future versions.

### 11.6 Token Invalidation

Use user-level token version.

Rules:

1. User table stores `token_version`.
2. Access Token includes `token_version` claim.
3. Refresh session stores `token_version` snapshot.
4. Password change increments `token_version`.
5. User disabled increments `token_version` or otherwise invalidates all active sessions.
6. Administrator password reset increments `token_version` and forces password change on next login.

### 11.7 Logout Behavior

Logout must revoke the current login session and invalidate refresh token usage. Access token validity is controlled through token version and configured expiration.

### 11.8 Session Table

The login session table must contain:

| Field              | Notes                                            |
| ------------------ | ------------------------------------------------ |
| session_id         | Public session identifier, serialized as string. |
| user_id            | User ID.                                         |
| organization_id    | Current organization at login/session creation.  |
| refresh_token_hash | Hashed refresh token. Never store raw token.     |
| token_version      | Snapshot from user at session creation/refresh.  |
| ip                 | Login IP.                                        |
| user_agent         | User-Agent.                                      |
| login_at           | UTC login time.                                  |
| last_activity_at   | UTC last activity.                               |
| expires_at         | UTC expiration.                                  |
| status             | active / revoked / expired.                      |

Online user viewing must be based on this session table.

### 11.9 Password and Account Security

| Rule                           | Confirmed Requirement                                                         |
| ------------------------------ | ----------------------------------------------------------------------------- |
| Password complexity            | Default minimum 8 characters, must include letters and numbers. Configurable. |
| First login password change    | Required when flagged.                                                        |
| Periodic password change       | Default 365 days.                                                             |
| Failed login lock              | Administrator-configurable failure count and lock duration.                   |
| Administrator password reset   | Required. User must change password after reset.                              |
| Self-service password recovery | Not required in v1.                                                           |

---

## 12. Authorization and Permission System

### 12.1 Permission Model

The system uses RBAC plus custom data permission rules and field permissions.

Confirmed rules:

1. A user can belong to multiple organizations.
2. A user has one role per organization.
3. Roles are not divided into system-level or organization-level types.
4. Role scope is controlled through permission and data rules.
5. Built-in roles: Super Administrator, Organization Administrator, Normal User.
6. Super Administrator is not restricted by organization and may manage all organizations and data.

### 12.2 Permission Levels

The system must support:

1. Menu permissions.
2. Page permissions.
3. Button/action permissions.
4. API permissions.
5. Data permissions.
6. Field permissions.

### 12.3 Permission Conflict Rule

When multiple rules apply, use priority:

```text
User permission > Role permission > Organization permission > System default permission
```

### 12.4 API Permission Declaration

Use route metadata bound to a permission manifest code.

Pattern:

```ts
// permission manifest
export const USER_PERMISSIONS = {
  USER_LIST: "system.user.list",
  USER_CREATE: "system.user.create",
  USER_UPDATE: "system.user.update",
  USER_DELETE: "system.user.delete",
};

// route declaration
app.get(
  "/api/users",
  withPermission(USER_PERMISSIONS.USER_LIST),
  validateQuery(listUsersSchema),
  listUsersHandler,
);
```

### 12.5 Permission Manifest Generation

Build-time generation is required.

Workflow:

1. Source code contains route metadata and permission manifest.
2. Build step generates JSON manifest.
3. Administrator reviews and confirms synchronization in the admin UI.
4. Confirmed permissions are synchronized to database.

Do not auto-sync new permissions to production DB without administrator confirmation.

### 12.6 Menu and Route Manifest

Frontend route metadata is the source of route code.

Confirmed design:

1. TanStack Router uses file routes.
2. Business route metadata is maintained separately from route files.
3. Backend menu configuration binds to frontend route code.
4. Frontend receives menu tree from backend and renders dynamic admin navigation.

Route metadata example:

```ts
export const routeMetadata = {
  routeCode: "system.users.list",
  path: "/system/users",
  titleI18nKey: "menu.system.users",
  requiredPermission: "system.user.list",
  layout: "admin",
};
```

### 12.7 Data Permission Rules

Use JSON DSL plus code-registered rule handlers.

Preset data scopes must include:

1. Own data.
2. Current organization data.
3. Current organization and descendant organization data.
4. Specified organization data.
5. All data.
6. Custom by user.
7. Custom by role.
8. Resource-specific scope.
9. Expression-based configuration.

JSON DSL example:

```json
{
  "operator": "and",
  "conditions": [
    {
      "field": "organization_id",
      "op": "inCurrentOrgAndDescendants"
    },
    {
      "field": "created_by",
      "op": "eqCurrentUser",
      "enabledWhen": "ownOnly"
    }
  ]
}
```

Complex rule handlers example:

```ts
registerDataRuleHandler("inCurrentOrgAndDescendants", async (ctx) => {
  return buildOrgDescendantPredicate(ctx.currentOrganization.path, ctx.currentOrganization.level);
});
```

### 12.8 Field Permissions

Confirmed implementation layer:

1. Backend API response filtering.
2. Frontend field hiding.

Export fields are **not** controlled by field permission in v1. Export fields are controlled by export permissions and export configuration.

Field permission granularity:

1. Module + field.
2. Page scenario: list/detail/form/export.
3. API response schema.

Even though export is a recognized scenario in field metadata, actual export field control is owned by the import/export framework in v1.

### 12.9 Permission Cache

Use Cache Adapter.

Invalidation rule:

1. When user, role, organization, permission, menu, data permission, or field permission changes, immediately clear related user permission cache.
2. The frontend must refetch permissions after current organization changes.
3. Switching current organization refreshes menus, buttons, API permission context, data permissions, and field permissions.

---

## 13. Core Data Model Draft

This data model is close to database design but avoids database-specific type syntax where possible.

### 13.1 Common Columns

Most persisted tables should include:

```text
id auto-increment primary key
tenant_id nullable reserved
created_at UTC
updated_at UTC
created_by nullable
updated_by nullable
is_deleted boolean/integer
removed fields where table is ephemeral
```

Tables requiring deletion audit include:

```text
deleted_at nullable
deleted_by nullable
```

### 13.2 Users

| Table | Key Fields                                                                                                                                                                                                                                                                                                                                       |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| users | id, tenant_id, username, display_name, email, phone, avatar_file_id, gender, employee_no, primary_organization_id, status, password_hash, password_changed_at, force_password_change, token_version, locked_until, failed_login_count, remark, last_login_at, is_deleted, deleted_at, deleted_by, created_at, updated_at, created_by, updated_by |

Constraints:

1. username unique among non-deleted users.
2. email unique.
3. phone unique.
4. email and phone are required by PRD requirement.
5. username may be changed by administrator.

### 13.3 Organizations

| Table         | Key Fields                                                                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| organizations | id, tenant_id, path, level, segment, name, code, manager_user_id, phone, email, address, sort_order, status, remark, is_deleted, deleted_at, deleted_by, created_at, updated_at, created_by, updated_by |

No `parent_id` field is stored in v1.

### 13.4 Roles and User-Organization-Role

| Table                   | Key Fields                                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| roles                   | id, tenant_id, code, name, description, status, data_scope_rule_id, is_builtin, is_deleted, deleted_at, deleted_by, created_at, updated_at, created_by, updated_by |
| user_organization_roles | id, tenant_id, user_id, organization_id, role_id, is_primary, status, created_at, updated_at, created_by, updated_by                                               |

Constraints:

1. Unique active assignment: one user can have only one role per organization.
2. A user may belong to multiple organizations.
3. A user has one primary organization.

### 13.5 Permissions

| Table                     | Key Fields                                                                                                 |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- |
| permissions               | id, code, name, type, resource, action, description, source, status, manifest_hash, created_at, updated_at |
| role_permissions          | id, role_id, permission_id, effect, created_at, updated_at                                                 |
| user_permission_overrides | id, user_id, organization_id nullable, permission_id, effect, created_at, updated_at                       |

Permission types:

```text
menu
page
action
api
data
field
```

### 13.6 Menus and Routes

| Table                | Key Fields                                                                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| menus                | id, parent_id nullable, route_code nullable, permission_code nullable, name_i18n_key, icon, sort_order, visible, status, created_at, updated_at |
| menu_actions         | id, menu_id, action_code, permission_code, name_i18n_key, sort_order, status                                                                    |
| route_manifest_items | id, route_code, path, title_i18n_key, required_permission_code, metadata_json, manifest_hash, status, created_at, updated_at                    |

Menu tree may use `parent_id`; organization tree does not.

### 13.7 Data Permissions

| Table                          | Key Fields                                                                                         |
| ------------------------------ | -------------------------------------------------------------------------------------------------- |
| data_permission_rules          | id, code, name, resource_type, rule_json, handler_code nullable, status, created_at, updated_at    |
| role_data_permissions          | id, role_id, resource_type, rule_id, params_json, created_at, updated_at                           |
| user_data_permission_overrides | id, user_id, organization_id nullable, resource_type, rule_id, params_json, created_at, updated_at |

### 13.8 Field Permissions

| Table                           | Key Fields                                                                                                           |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| field_permission_rules          | id, resource_type, field_code, scenario, api_schema_path nullable, visible, editable, status, created_at, updated_at |
| role_field_permissions          | id, role_id, field_rule_id, effect_json, created_at, updated_at                                                      |
| user_field_permission_overrides | id, user_id, organization_id nullable, field_rule_id, effect_json, created_at, updated_at                            |

Scenarios:

```text
list
detail
create_form
edit_form
export
api_response
```

### 13.9 Auth Sessions

| Table          | Key Fields                                                                                                                                                      |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| login_sessions | session_id, user_id, organization_id, refresh_token_hash, token_version, ip, user_agent, login_at, last_activity_at, expires_at, status, created_at, updated_at |

### 13.10 Files

| Table           | Key Fields                                                                                                                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| files           | id, tenant_id, storage_driver, bucket, object_key, original_name, mime_type, extension, size_bytes, checksum, visibility, status, uploaded_by, uploaded_at, is_deleted, deleted_at, deleted_by |
| file_references | id, file_id, resource_type, resource_id, reference_type, created_at, created_by                                                                                                                |

Deletion behavior:

- Referenced files may be deleted.
- Business data must display deleted/missing file state when a referenced file has been deleted.

### 13.11 Notifications and Announcements

| Table                  | Key Fields                                                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| announcements          | id, title, content, publish_scope, publish_at, expire_at, status, created_by, created_at, updated_at             |
| announcement_targets   | id, announcement_id, target_type, target_id                                                                      |
| notifications          | id, title, content, channel, recipient_user_id, status, read_at, archived_at, deleted_at, created_at, updated_at |
| notification_templates | id, code, channel, language, subject_template, body_template, variables_json, status, created_at, updated_at     |
| webhook_subscriptions  | id, name, url, secret_ref, event_types_json, status, created_at, updated_at                                      |

Announcement scopes:

1. Global/system-wide.
2. Organization-based.

In-app notification statuses:

```text
unread
read
archived
deleted
```

### 13.12 Logs

| Table               | Key Fields                                                                                                                                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| login_logs          | id, user_id nullable, username_input, result, failure_reason, ip, user_agent, occurred_at                                                                                                                      |
| operation_logs      | id, user_id, organization_id, module, action, resource_type, resource_id, result, detail_json, occurred_at                                                                                                     |
| access_logs         | id, user_id, organization_id, route_code, path, method, ip, user_agent, occurred_at                                                                                                                            |
| api_call_logs       | id, request_id, user_id nullable, organization_id nullable, method, path, status_code, duration_ms, log_level, request_json nullable, response_json nullable, error_json nullable, ip, user_agent, occurred_at |
| exception_logs      | id, request_id nullable, error_type, message, stack_ref nullable, context_json, occurred_at                                                                                                                    |
| security_logs       | id, user_id nullable, event_type, severity, detail_json, ip, user_agent, occurred_at                                                                                                                           |
| job_execution_logs  | id, job_id, task_code, status, started_at, finished_at, duration_ms, error_json nullable                                                                                                                       |
| file_operation_logs | id, user_id, file_id, operation, result, detail_json, occurred_at                                                                                                                                              |

All log writes are asynchronous through Queue in v1.

### 13.13 Import/Export

| Table               | Key Fields                                                                                                                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| import_export_tasks | id, type, module_code, status, file_id nullable, result_file_id nullable, error_report_file_id nullable, requested_by, requested_at, started_at, finished_at, expires_at, summary_json, error_preview_json |

Retention:

- Result files are retained for 30 days.

### 13.14 Jobs and Scheduler

| Table               | Key Fields                                                                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| scheduled_tasks     | id, code, name, cron_expression, status, execution_scope, lock_key nullable, timeout_seconds, retry_enabled, retry_limit, parameters_json, last_run_at, next_run_at, created_at, updated_at |
| scheduled_task_runs | id, task_id, worker_id, status, started_at, finished_at, error_json nullable, result_json nullable                                                                                          |
| queue_jobs          | id, queue_name, job_type, payload_json, status, priority, run_after, attempt_count, max_attempts, locked_by, locked_until, error_json, result_json, created_at, updated_at                  |

### 13.15 System Configuration and Dictionaries

| Table               | Key Fields                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------ |
| system_config_items | id, key, value_json, value_type, description, is_sensitive, status, created_at, updated_at |
| dictionary_types    | id, code, name_i18n_key, description, status, created_at, updated_at                       |
| dictionary_items    | id, type_id, code, value, label_i18n_key, sort_order, status, created_at, updated_at       |

Organization-level config and dictionary overrides are reserved only.

### 13.16 i18n

| Table         | Key Fields                                                            |
| ------------- | --------------------------------------------------------------------- |
| i18n_messages | id, namespace, key, language, message, status, created_at, updated_at |

Languages:

1. Chinese.
2. English.

User language rule:

1. System administrator sets default language.
2. User may override language in personal settings.

---

## 14. Logging and Audit Design

### 14.1 Log Write Strategy

Final confirmed strategy:

- All logs are written asynchronously through Queue.
- Business requests must not be blocked by log persistence.
- If Queue is unavailable, logs fall back to local file logging.

This supersedes the earlier synchronous audit logging idea.

### 14.2 API Log Level

API log level is configurable per interface.

Levels:

```text
none
basic
request
request_response
```

Sensitive fields must always be masked.

Examples of sensitive fields:

```text
password
token
accessToken
refreshToken
authorization
cookie
phone
email
secret
apiKey
```

### 14.3 Queue Failure Fallback

If Queue is unavailable:

1. Do not block business request.
2. Write the log event to local fallback log file.
3. The fallback file path must be configurable.
4. The system should expose a warning metric or health detail.

### 14.4 Log Retention

All log types default to 90 days and allow separate adjustment per log type.

CSV log export:

1. All log exports use asynchronous export tasks.
2. First version exports CSV only.
3. Export result is visible in the export task list.
4. No completion notification is required.

---

## 15. File Management Design

### 15.1 Storage Drivers

v1 supports:

1. Local shared directory storage.
2. S3-compatible object storage.

### 15.2 Default File Limits

| Setting               | Value                               |
| --------------------- | ----------------------------------- |
| Default max file size | 50 MB                               |
| Whitelisted images    | jpg, jpeg, png, webp, gif           |
| Whitelisted documents | pdf, doc, docx, xls, xlsx, csv, txt |
| Whitelisted archive   | zip                                 |

### 15.3 File Permissions

Required permissions:

1. Upload.
2. Download.
3. Delete.
4. Preview image.
5. Manage metadata.

PDF preview is not required.

### 15.4 Deletion and References

Confirmed behavior:

- Referenced files may be deleted.
- Business data must show file invalid/deleted state.
- Deleting business data must not automatically delete files unless a future business module explicitly defines that behavior.

---

## 16. Import/Export Design

### 16.1 Format

v1 implements CSV only. Excel is reserved for future versions.

No generic ImportExport Adapter is required in v1. The spec only documents future Excel extension.

### 16.2 Execution

Large import/export tasks run according to deployment mode:

| Deployment Mode           | Execution                     |
| ------------------------- | ----------------------------- |
| Single process            | In-process job may be used.   |
| Worker-enabled deployment | Queue job should be used.     |
| Multi-server deployment   | Queue adapter should be used. |

### 16.3 Result File Storage

Import/export result files use File Storage Adapter.

### 16.4 Import Error Feedback

The UI must display the first N validation errors and provide a complete downloadable error report. The exact N must be configurable; no hard-coded number is mandated by this spec.

### 16.5 Export Completion

No notification is required when an export task completes. Users check the export task list.

### 16.6 Retention

Import/export result files are retained for 30 days.

---

## 17. Notification and Announcement Design

### 17.1 Announcement

Announcement publish scope:

1. System-wide.
2. Organization-based.

Required functions:

1. Create announcement.
2. Edit draft.
3. Publish.
4. Unpublish/withdraw if applicable.
5. View announcement list.
6. Filter by status, publish time, and scope.

### 17.2 In-App Notifications

Statuses:

```text
unread
read
archived
deleted
```

Required functions:

1. View list.
2. Mark as read.
3. Archive.
4. Delete.

### 17.3 Templates

Template management must support:

1. In-app notification templates.
2. Email templates.
3. SMS templates as reserved abstraction.
4. Multi-language templates.
5. Template variables.

### 17.4 Channels

v1 channels:

1. SMTP email.
2. Webhook.
3. SMS placeholder only.

Webhook supports both notification sending and event subscription.

---

## 18. API Design

### 18.1 Route Base

v1 routes use:

```text
/api
```

Future versioning must allow:

```text
/api/v2
```

Do not use `/api/v1` in v1.

### 18.2 API Contract Strategy

Confirmed boundary:

1. Frontend/internal client uses Hono RPC type inference.
2. OpenAPI is generated from Hono routes + Zod schemas.
3. OpenAPI is used for documentation and external integration.

### 18.3 Response Envelope

Use a consistent response envelope.

Success:

```json
{
  "success": true,
  "data": {},
  "requestId": "req_xxx"
}
```

Failure:

```json
{
  "success": false,
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message": "Invalid username or password.",
    "details": {}
  },
  "requestId": "req_xxx"
}
```

### 18.4 Error Code Categories

Required categories:

| Category       | Prefix           | Examples                                                      |
| -------------- | ---------------- | ------------------------------------------------------------- |
| Authentication | `AUTH_`          | `AUTH_INVALID_CREDENTIALS`, `AUTH_TOKEN_EXPIRED`              |
| Authorization  | `PERMISSION_`    | `PERMISSION_DENIED`, `PERMISSION_SCOPE_DENIED`                |
| Validation     | `VALIDATION_`    | `VALIDATION_REQUIRED`, `VALIDATION_INVALID_FORMAT`            |
| Business       | `BUSINESS_`      | `BUSINESS_ORG_DISABLED`, `BUSINESS_DUPLICATE_CODE`            |
| System         | `SYSTEM_`        | `SYSTEM_INTERNAL_ERROR`, `SYSTEM_CONFIG_INVALID`              |
| Third-party    | `THIRD_PARTY_`   | `THIRD_PARTY_EMAIL_FAILED`, `THIRD_PARTY_WEBHOOK_FAILED`      |
| Import/Export  | `IMPORT_EXPORT_` | `IMPORT_EXPORT_INVALID_TEMPLATE`, `IMPORT_EXPORT_TASK_FAILED` |
| File           | `FILE_`          | `FILE_TYPE_NOT_ALLOWED`, `FILE_TOO_LARGE`                     |

### 18.5 Endpoint Draft

The OpenAPI output must include request/response schemas. The following endpoint groups define the minimum route surface for Codex implementation.

#### Auth

| Method | Path                        | Purpose                                                                 |
| ------ | --------------------------- | ----------------------------------------------------------------------- |
| POST   | `/api/auth/login`           | Login with username and password.                                       |
| POST   | `/api/auth/refresh`         | Refresh access token using HttpOnly refresh cookie and CSRF protection. |
| POST   | `/api/auth/logout`          | Revoke current session.                                                 |
| GET    | `/api/auth/me`              | Get current user profile, organization context, permissions summary.    |
| POST   | `/api/auth/change-password` | Change current user's password.                                         |

#### Current Context

| Method | Path                                | Purpose                                                     |
| ------ | ----------------------------------- | ----------------------------------------------------------- |
| GET    | `/api/context/organizations`        | List organizations available to current user.               |
| POST   | `/api/context/current-organization` | Switch current organization and refresh permission context. |
| GET    | `/api/context/permissions`          | Get menu/action/data/field permission context.              |

#### Users

| Method | Path                                           | Purpose                                |
| ------ | ---------------------------------------------- | -------------------------------------- |
| GET    | `/api/users`                                   | Paginated user list.                   |
| POST   | `/api/users`                                   | Create user.                           |
| GET    | `/api/users/:id`                               | User detail.                           |
| PATCH  | `/api/users/:id`                               | Update user.                           |
| DELETE | `/api/users/:id`                               | Soft delete user.                      |
| POST   | `/api/users/:id/reset-password`                | Administrator resets password.         |
| POST   | `/api/users/:id/organizations`                 | Assign user to organization with role. |
| DELETE | `/api/users/:id/organizations/:organizationId` | Remove organization assignment.        |

#### Organizations

| Method | Path                             | Purpose                                                |
| ------ | -------------------------------- | ------------------------------------------------------ |
| GET    | `/api/organizations/tree`        | Organization tree.                                     |
| POST   | `/api/organizations`             | Create organization.                                   |
| GET    | `/api/organizations/:id`         | Organization detail.                                   |
| PATCH  | `/api/organizations/:id`         | Update organization.                                   |
| POST   | `/api/organizations/:id/disable` | Disable organization and descendants.                  |
| POST   | `/api/organizations/:id/enable`  | Enable organization.                                   |
| DELETE | `/api/organizations/:id`         | Soft delete organization if allowed by business rules. |

#### Roles and Permissions

| Method | Path                               | Purpose                                 |
| ------ | ---------------------------------- | --------------------------------------- |
| GET    | `/api/roles`                       | Paginated role list.                    |
| POST   | `/api/roles`                       | Create role.                            |
| GET    | `/api/roles/:id`                   | Role detail.                            |
| PATCH  | `/api/roles/:id`                   | Update role.                            |
| DELETE | `/api/roles/:id`                   | Soft delete role.                       |
| POST   | `/api/roles/:id/copy`              | Copy role and permission configuration. |
| GET    | `/api/permissions`                 | List permissions.                       |
| GET    | `/api/permissions/manifest`        | Preview generated permission manifest.  |
| POST   | `/api/permissions/sync`            | Admin-confirmed permission sync.        |
| PUT    | `/api/roles/:id/permissions`       | Update role permissions.                |
| PUT    | `/api/roles/:id/data-permissions`  | Update role data permission rules.      |
| PUT    | `/api/roles/:id/field-permissions` | Update role field permission rules.     |

#### Menus and Routes

| Method | Path                   | Purpose                              |
| ------ | ---------------------- | ------------------------------------ |
| GET    | `/api/menus/tree`      | Menu tree management data.           |
| POST   | `/api/menus`           | Create menu.                         |
| PATCH  | `/api/menus/:id`       | Update menu.                         |
| DELETE | `/api/menus/:id`       | Delete menu.                         |
| GET    | `/api/routes/manifest` | View frontend route manifest.        |
| POST   | `/api/routes/sync`     | Admin-confirmed route manifest sync. |

#### System Config and Dictionaries

| Method | Path                              | Purpose                 |
| ------ | --------------------------------- | ----------------------- |
| GET    | `/api/system-config`              | List config items.      |
| PATCH  | `/api/system-config/:key`         | Update config value.    |
| GET    | `/api/dictionary-types`           | List dictionary types.  |
| POST   | `/api/dictionary-types`           | Create dictionary type. |
| PATCH  | `/api/dictionary-types/:id`       | Update dictionary type. |
| GET    | `/api/dictionary-types/:id/items` | List dictionary items.  |
| POST   | `/api/dictionary-types/:id/items` | Create dictionary item. |
| PATCH  | `/api/dictionary-items/:id`       | Update dictionary item. |

#### Files

| Method | Path                      | Purpose                                                  |
| ------ | ------------------------- | -------------------------------------------------------- |
| POST   | `/api/files/upload`       | Upload file.                                             |
| GET    | `/api/files`              | File list.                                               |
| GET    | `/api/files/:id`          | File metadata.                                           |
| GET    | `/api/files/:id/download` | Authenticated download.                                  |
| DELETE | `/api/files/:id`          | Delete file metadata/object according to storage policy. |

#### Notifications and Announcements

| Method | Path                               | Purpose                       |
| ------ | ---------------------------------- | ----------------------------- |
| GET    | `/api/announcements`               | List announcements.           |
| POST   | `/api/announcements`               | Create announcement.          |
| PATCH  | `/api/announcements/:id`           | Update announcement.          |
| POST   | `/api/announcements/:id/publish`   | Publish announcement.         |
| POST   | `/api/announcements/:id/unpublish` | Unpublish announcement.       |
| GET    | `/api/notifications`               | Current user's notifications. |
| POST   | `/api/notifications/:id/read`      | Mark read.                    |
| POST   | `/api/notifications/:id/archive`   | Archive.                      |
| DELETE | `/api/notifications/:id`           | Delete notification.          |
| GET    | `/api/notification-templates`      | Template list.                |
| POST   | `/api/notification-templates`      | Create template.              |
| PATCH  | `/api/notification-templates/:id`  | Update template.              |
| GET    | `/api/webhooks`                    | Webhook subscriptions.        |
| POST   | `/api/webhooks`                    | Create webhook subscription.  |
| PATCH  | `/api/webhooks/:id`                | Update webhook subscription.  |

#### Logs

| Method | Path                  | Purpose                       |
| ------ | --------------------- | ----------------------------- |
| GET    | `/api/logs/login`     | Login logs.                   |
| GET    | `/api/logs/operation` | Operation logs.               |
| GET    | `/api/logs/access`    | Access logs.                  |
| GET    | `/api/logs/api`       | API call logs.                |
| GET    | `/api/logs/exception` | Exception logs.               |
| GET    | `/api/logs/security`  | Security logs.                |
| GET    | `/api/logs/jobs`      | Job logs.                     |
| GET    | `/api/logs/files`     | File operation logs.          |
| POST   | `/api/logs/export`    | Create async CSV export task. |

#### Jobs and Import/Export

| Method | Path                                  | Purpose                            |
| ------ | ------------------------------------- | ---------------------------------- |
| GET    | `/api/scheduled-tasks`                | Scheduled task list.               |
| POST   | `/api/scheduled-tasks`                | Create task.                       |
| PATCH  | `/api/scheduled-tasks/:id`            | Update task.                       |
| POST   | `/api/scheduled-tasks/:id/enable`     | Enable task.                       |
| POST   | `/api/scheduled-tasks/:id/disable`    | Disable task.                      |
| POST   | `/api/scheduled-tasks/:id/run`        | Manual run.                        |
| GET    | `/api/import-export/tasks`            | Import/export task list.           |
| POST   | `/api/import-export/import`           | Create import task.                |
| POST   | `/api/import-export/export`           | Create export task.                |
| GET    | `/api/import-export/tasks/:id`        | Task detail.                       |
| GET    | `/api/import-export/tasks/:id/result` | Download result file if available. |

#### i18n, Online Users, Initialization, Observability

| Method | Path                         | Purpose                                     |
| ------ | ---------------------------- | ------------------------------------------- |
| GET    | `/api/i18n/messages`         | Get i18n messages.                          |
| PATCH  | `/api/i18n/messages/:id`     | Update i18n message.                        |
| GET    | `/api/online-users`          | View online users based on active sessions. |
| GET    | `/api/initialization/status` | Check initialization status.                |
| POST   | `/api/initialization/setup`  | First-start initialization wizard.          |
| GET    | `/api/health`                | Health check.                               |
| GET    | `/api/metrics`               | Metrics endpoint or metrics placeholder.    |

---

## 19. Frontend Design

### 19.1 Frontend Stack

| Area         | Decision                                                                 |
| ------------ | ------------------------------------------------------------------------ |
| App type     | Vite SPA                                                                 |
| Router       | TanStack Router                                                          |
| UI           | shadcn/ui + Tailwind CSS                                                 |
| Form         | TanStack Form + Zod                                                      |
| Global state | Zustand                                                                  |
| Server state | TanStack Query                                                           |
| API client   | Hono RPC for internal client; OpenAPI for documentation/external clients |

### 19.2 State Boundary

Use Zustand for:

1. Auth UI state.
2. Current access token state derived from localStorage.
3. Current organization context.
4. Layout preferences.
5. Tab navigation preference.
6. Theme and dark mode.
7. Language preference cache.

Use TanStack Query for:

1. Server lists.
2. Details.
3. Mutations.
4. Permission context refetching.
5. Menu tree.
6. Dictionaries.
7. System config.

### 19.3 Layout

Required layout:

1. Classic left menu + top bar.
2. Breadcrumb navigation.
3. Page tabs.
4. Fullscreen mode.
5. Dark mode.
6. Theme color configuration.
7. Desktop admin experience.

Tab navigation:

- Enabled by default.
- User can disable it in personal settings.
- When disabled, navigation behaves like a typical SPA without persistent page tabs.

### 19.4 Frontend Directory

```text
apps/web/src/
  app/
    App.tsx
    providers.tsx
    router.tsx
  routes/
    __root.tsx
    login.tsx
    _admin/
      layout.tsx
      dashboard.tsx
      system/
        users.tsx
        organizations.tsx
        roles.tsx
        permissions.tsx
        menus.tsx
        dictionaries.tsx
        config.tsx
        files.tsx
        logs.tsx
        jobs.tsx
  route-metadata/
    index.ts
    system.routes.ts
  features/
    auth/
    users/
    organizations/
    roles/
    permissions/
    menus/
    files/
    notifications/
    logs/
    jobs/
    import-export/
    i18n/
  stores/
    auth.store.ts
    layout.store.ts
    organization.store.ts
  queries/
    query-client.ts
  forms/
  components/
  i18n/
  lib/
```

### 19.5 Frontend Route Metadata

Each protected route must have metadata:

```ts
export interface AdminRouteMetadata {
  routeCode: string;
  path: string;
  titleI18nKey: string;
  requiredPermission?: string;
  menuVisible: boolean;
  icon?: string;
  sortOrder?: number;
}
```

The route manifest is exported during build for backend menu binding.

---

## 20. Business Module Extension Specification

No sample business module is implemented. However, the base must provide strict extension contracts so future modules can be added consistently.

### 20.1 Required Module Template

A future module must follow this template:

```text
apps/api/src/modules/<module>/
  <module>.routes.ts
  <module>.service.ts
  <module>.repository.ts
  <module>.schemas.ts
  <module>.permissions.ts
  <module>.data-rules.ts
  <module>.field-rules.ts
  <module>.logs.ts
  <module>.import-export.ts optional
  <module>.test.ts

apps/web/src/features/<module>/
  pages/
  components/
  forms/
  queries/
  permissions.ts
  i18n.ts

packages/db/src/schema/<module>.ts
packages/contracts/src/api-schemas/<module>.ts
packages/contracts/src/permissions/<module>.ts
```

### 20.2 Required Integration Points

Every future module must define:

1. Route metadata.
2. Permission manifest.
3. API schemas.
4. Data permission resource type.
5. Field permission resource type.
6. Operation log mapping.
7. i18n keys.
8. Tests.

Optional integration points:

1. File references.
2. Import/export handlers.
3. Notification events.
4. Scheduled jobs.

---

## 21. Observability

Required v1 capabilities:

1. Health check endpoint.
2. Metrics placeholder or endpoint.
3. Trace ID / Request ID.
4. Structured logs.
5. Alerting interface placeholder.

### 21.1 Request ID

Every request must have a request ID.

Rules:

1. Accept incoming `x-request-id` if valid.
2. Generate one if absent.
3. Include it in response headers.
4. Include it in API logs and exception logs.

### 21.2 Health Check

Health check must include:

1. API liveness.
2. Database connectivity.
3. Queue adapter health if configured.
4. Cache adapter health if configured.
5. File storage adapter health if configured.

---

## 22. Initialization

Confirmed requirement: first-start initialization wizard plus command-line/seed script.

### 22.1 Initialization Methods

1. Web initialization wizard.
2. CLI/seed script.

### 22.2 Initial Data

Initialization must create:

1. Default root organization.
2. Super administrator account.
3. Built-in roles: Super Administrator, Organization Administrator, Normal User.
4. Base permission manifest records.
5. Base route manifest records.
6. Base menu tree.
7. Default system configuration.
8. Default dictionaries.
9. Default i18n messages.

### 22.3 Safety

1. Initialization can only run when the system is uninitialized.
2. Re-running seed must be idempotent where possible.
3. Secrets must not be committed to source code.

---

## 23. Testing Strategy

### 23.1 Required Test Types

Confirmed requirement:

1. Unit tests.
2. API integration tests.
3. Frontend component tests.

E2E tests are not required in v1.

### 23.2 Database Test Scope

Only PostgreSQL is included in CI/integration database testing.

SQLite is used for local development, local testing, and demo usage, but does not enter CI by requirement.

### 23.3 Frontend Component Test Tool

Use Vitest + React Testing Library.

### 23.4 Suggested Test Organization

```text
apps/api/test/
  integration/
  unit/
apps/worker/test/
apps/web/test/
packages/db/test/
packages/adapters/test/
```

### 23.5 Required Test Focus

1. Auth login/refresh/logout.
2. Password policy and account lock.
3. User-organization-role relationship.
4. Organization materialized path helper functions.
5. Permission evaluation.
6. Data permission DSL compilation.
7. Field response filtering.
8. Adapter contract tests.
9. Import/export task creation and result retrieval.
10. Async log queue fallback behavior.
11. Frontend protected routing.
12. Frontend permission-based menu rendering.

---

## 24. Recommended Commands

Codex should keep commands package-manager consistent with pnpm.

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm test:api
pnpm test:web
pnpm db:generate
pnpm db:migrate:sqlite
pnpm db:migrate:postgresql
pnpm dev
pnpm dev:api
pnpm dev:web
pnpm dev:worker
pnpm build
```

Exact script internals are implementation tasks, but these command names should be created for consistency.

---

## 25. Module-Level Codex Implementation Plan

The requested execution plan granularity is module-level tasks plus recommended commands.

### Phase 1 — Repository Foundation

Implement:

1. pnpm workspace.
2. TypeScript base config.
3. Apps and packages skeleton.
4. Lint/typecheck/test scripts.
5. Config loader skeleton.

Recommended validation:

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
```

### Phase 2 — Database Foundation

Implement:

1. Drizzle schema foundation.
2. SQLite and PostgreSQL migration directories.
3. Common schema files.
4. Database connection factory.
5. Seed framework.
6. Materialized path helper functions.

Recommended validation:

```bash
pnpm db:generate
pnpm db:migrate:sqlite
pnpm db:migrate:postgresql
pnpm test --filter @web-admin-base/db
```

### Phase 3 — Adapter Foundation

Implement:

1. Cache adapter interfaces and drivers.
2. Queue adapter interfaces and drivers.
3. Event bus interfaces and drivers.
4. Token store interface and drivers.
5. File storage interface and drivers.
6. Notification interface and SMTP/webhook drivers.
7. Rate-limit interface and drivers.
8. Lock interface and in-memory driver; database lock abstraction without unconfirmed internal algorithm.

Recommended validation:

```bash
pnpm test --filter @web-admin-base/adapters
pnpm typecheck
```

### Phase 4 — API Core

Implement:

1. Hono app bootstrap.
2. Request ID middleware.
3. Error handling and response envelope.
4. Auth context middleware.
5. Permission middleware.
6. OpenAPI generation from Hono routes + Zod.
7. Hono RPC type export.

Recommended validation:

```bash
pnpm test:api
pnpm typecheck
```

### Phase 5 — Auth and Session

Implement:

1. Login.
2. Refresh token cookie flow.
3. CSRF protection for cookie auth endpoints.
4. Logout.
5. Token version invalidation.
6. Login session table and online user query.
7. Password policy.
8. Administrator reset password.

Recommended validation:

```bash
pnpm test:api -- auth
pnpm typecheck
```

### Phase 6 — Organization, Users, Roles, Permissions

Implement:

1. Organization CRUD without move.
2. Organization path allocation.
3. Organization disable cascade.
4. User CRUD.
5. User-organization-role assignment.
6. Role CRUD and copy.
7. Permission manifest generation and admin-confirmed sync.
8. Menu/route manifest management.
9. Permission cache invalidation.

Recommended validation:

```bash
pnpm test:api -- organizations users roles permissions
pnpm typecheck
```

### Phase 7 — Data and Field Permission Engines

Implement:

1. Data permission JSON DSL parser.
2. Code-registered rule handlers.
3. SQL predicate generation hooks.
4. Field permission API response filtering.
5. Frontend field visibility contract.

Recommended validation:

```bash
pnpm test:api -- permissions
pnpm typecheck
```

### Phase 8 — Base System Modules

Implement:

1. System configuration.
2. Dictionary management.
3. File management.
4. Announcements.
5. In-app notifications.
6. Email notifications.
7. Webhook subscriptions.
8. i18n message management.

Recommended validation:

```bash
pnpm test:api
pnpm typecheck
```

### Phase 9 — Logs, Worker, Scheduler, Import/Export

Implement:

1. Worker app.
2. Async log queue.
3. Queue fallback to local file.
4. Scheduled task framework.
5. Per-node and cluster-singleton task scopes.
6. CSV import/export task framework.
7. Result file retention.
8. Async log export.

Recommended validation:

```bash
pnpm dev:worker
pnpm test --filter @web-admin-base/worker
pnpm test:api
```

### Phase 10 — Frontend Shell and Modules

Implement:

1. Vite React app.
2. shadcn/ui + Tailwind setup.
3. TanStack Router file routes.
4. Route metadata.
5. Zustand stores.
6. TanStack Query client.
7. Hono RPC client integration.
8. Login page.
9. Admin layout.
10. Dynamic menu rendering.
11. Theme, dark mode, fullscreen, tabs preference.
12. Base management pages.

Recommended validation:

```bash
pnpm dev:web
pnpm test:web
pnpm typecheck
pnpm build
```

### Phase 11 — Initialization and Observability

Implement:

1. Initialization wizard.
2. CLI seed script.
3. Health check.
4. Metrics placeholder/endpoint.
5. Structured logging.
6. Request ID propagation.

Recommended validation:

```bash
pnpm db:migrate:sqlite
pnpm seed
pnpm dev
pnpm test
```

---

## 26. Acceptance Criteria

### 26.1 System Startup

1. The system can start with SQLite for local/demo use.
2. The system can connect to PostgreSQL for deployment use.
3. The API exposes `/api/health`.
4. The frontend can load the login page.
5. The worker can start independently.

### 26.2 Authentication

1. User can log in with username/password.
2. Access token is stored by frontend according to spec.
3. Refresh token is set as HttpOnly Cookie.
4. Refresh/logout endpoints require CSRF protection.
5. Password policy and lock rule are enforced.
6. Password reset invalidates existing tokens through token version.

### 26.3 Organization and Permission

1. User can belong to multiple organizations.
2. User has one role per organization.
3. Login enters primary organization.
4. Switching organization refreshes permissions and menus.
5. Organization path supports up to 8 levels with confirmed segment constraints.
6. Organization movement is not available.
7. Disabling organization disables descendants.

### 26.4 Base Modules

1. User, organization, role, permission, menu modules are usable.
2. System config and dictionary modules are usable.
3. File upload/download/delete works through configured storage adapter.
4. Notifications, announcements, email, webhook abstractions are usable.
5. Logs are written asynchronously through queue.
6. Queue failure falls back to local file logs.
7. Scheduled tasks run according to execution scope.
8. CSV import/export tasks are created and result files retained for 30 days.

### 26.5 Frontend

1. Admin layout uses left menu + top bar.
2. Breadcrumb works.
3. Page tabs can be disabled in personal settings.
4. Theme and dark mode work.
5. Menu visibility follows backend permissions.
6. Field visibility follows field permission API response.

### 26.6 Quality

1. `pnpm typecheck` passes.
2. `pnpm lint` passes.
3. `pnpm test` passes.
4. `pnpm build` passes.
5. API integration tests run against PostgreSQL.
6. Frontend component tests use Vitest + React Testing Library.

---

## 27. Implementation Guardrails

1. Any new code path that creates a route must declare route metadata and permission code.
2. Any new persistent entity must include `tenant_id` where future tenant isolation may apply.
3. Any new API that returns IDs must serialize IDs as strings.
4. Any new API response that includes sensitive fields must pass field filtering and masking.
5. Any new async capability must use Queue Adapter rather than direct background promises.
6. Any log event must go through the logging queue abstraction.
7. Any file write must go through File Storage Adapter.
8. Any notification must go through Notification Channel Adapter.
9. Any scheduled cluster-singleton task must acquire Lock Adapter before executing.
10. Do not introduce unconfirmed drivers, runtimes, ORMs, routers, or form libraries.

---

## 28. Future Extension Notes

The following are intentionally reserved and must not be implemented in v1 without a new requirement confirmation:

1. SQL Server implementation.
2. Bun/Deno runtime compatibility.
3. SQL Server Drizzle adapter and migrations.
4. Excel import/export.
5. SSO providers.
6. MFA/2FA.
7. SMS providers.
8. Tenant management UI/API.
9. Position/job management.
10. Online user kick-out.
11. Mobile/tablet optimization.
12. Organization-level config/dictionary overrides.
13. Refresh token rotation.
14. Session-level token versioning.
15. Detailed dead-letter queue behavior.
16. Concrete database lock internal algorithm, unless separately confirmed.
17. Concrete SQLite driver package, unless separately confirmed.
