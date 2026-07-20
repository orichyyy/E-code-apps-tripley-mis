# Use a static, namespaced Business Module Registry

Business Modules are compiled into a release through explicit, typed registration rather than discovered or installed at runtime. Each module has a permanent `moduleCode`, a serializable Business Module Definition, and separate API, Web, Worker, and database registrations; build-time conformance proves that declarations and implementations agree while preserving Hono RPC and TanStack file routing.

The Base System remains a trusted compatibility definition and the production Business Module Registry initially contains no business modules. Module metadata is applied through an administrator-reviewed, transactional Module Sync Plan, while migrations remain an append-only deployment step. New or security-relevant changes are fail-closed per module until accepted; unchanged modules and the Base System remain active.

This rejects directory scanning, dynamic packages, runtime install/uninstall, inter-business-module dependencies, raw SQL rule handlers, and public business APIs. The trade-off is deliberate release-time composition and explicit route files in exchange for deterministic builds, ownership enforcement, portable SQLite/PostgreSQL migrations, and auditable authorization boundaries.
