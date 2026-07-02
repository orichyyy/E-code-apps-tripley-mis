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

The durable DB-backed sync path remains a known gap until database provisioning is confirmed.
