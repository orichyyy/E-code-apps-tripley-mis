# Permission Extension Guide

Permission metadata is defined in `packages/contracts`.

Important files:

- `packages/contracts/src/permissions/permission-manifest.ts`
- `packages/contracts/src/manifests/base-api-permissions.ts`
- `packages/contracts/src/manifests/base-routes.ts`
- `packages/contracts/src/manifests/base-menus.ts`

## Adding Permissions

1. Add stable permission codes to the permission manifest.
2. Add API permission metadata for new backend routes.
3. Add route metadata for frontend pages.
4. Add menu metadata when the page should appear in navigation.
5. Run tests to verify manifest consistency.
6. Use the admin sync endpoints to sync generated metadata into the current backing store.

Implemented sync endpoints:

- `POST /api/permissions/sync`
- `POST /api/permissions/api/sync`
- `POST /api/routes/sync`

When `BACKEND_CORE_STORE=database` is enabled, these sync endpoints persist through the DB-backed repositories. The default in-memory mode remains process-local and is intended for focused tests and non-persistent demos.

## Business Module Data And Field Rules

Business Module Data Resources bind explicitly to a `data` permission. Role data
rules use the strict version 1 AST from `@web-admin-base/contracts`; arbitrary JSON
and SQL expressions are rejected. Effective permission codes already include user
allow/deny overrides and must be passed into the data-permission execution context.

Role field rules include `resource`, `field`, `scenario`, and `effect`. Scenarios are
`list`, `detail`, `create`, and `edit`; effects are `visible`, `readonly`, and
`hidden`. Backend response filtering and write rejection are authoritative. See ADR
0006 and `docs/business_module_extension_guide.md` for the execution sequence.
