# Local Run Acceptance

This runbook verifies that a developer can run the Web Admin Base System locally and inspect the implemented base-system surfaces without enabling optional external integrations.

## Scope

This checklist covers the local SQLite demo path, the repeatable smoke script, and a manual browser walkthrough of implemented base pages.

It does not validate Redis, RabbitMQ, S3-compatible storage, SMS sending, or real outbound webhook delivery. Those integrations remain optional or reserved unless explicitly configured by a future goal.

## Prerequisites

- Node.js only for backend/runtime execution.
- pnpm matching the root `packageManager` field.
- A browser available to Playwright or the system. If no Chrome or Edge is installed, run:

```bash
pnpm exec playwright install chromium
```

For full local quality-gate verification, PostgreSQL must also be available through `TEST_DATABASE_URL` or `DATABASE_URL`.

## Automated Acceptance

Run from the repository root:

```bash
pnpm install
pnpm verify
```

Expected result:

- Formatting, linting, typechecking, tests, SQLite migrations, PostgreSQL migrations, local smoke, and production build all pass.
- `pnpm smoke:local` starts the API, web app, and worker against a temporary SQLite database.
- The smoke script logs in through the Vite proxy, verifies implemented base APIs, opens the admin shell in a browser, checks expected navigation entries, and cleans generated smoke data unless `SMOKE_KEEP_DATA=1` is set.

If PostgreSQL is not available, run the SQLite/browser smoke path separately:

```bash
pnpm install
pnpm smoke:local
```

Expected result:

- The command ends with `Local smoke passed.`
- No generated `data/` or `.tmp/` artifacts need to be committed.

## Persistent SQLite Manual Run

Use this path when manually checking the UI in a browser:

```powershell
pnpm dev:local
```

The script prints the browser URL and seeded administrator account. Its default Web URL is:

```text
http://localhost:5173/login
```

Equivalent manual setup:

```powershell
$env:BACKEND_CORE_STORE = "database"
$env:DATABASE_DIALECT = "sqlite"
$env:DATABASE_URL = "file:./data/web-admin-base.sqlite"
$env:FILE_STORAGE_ROOT = "./data/files"
$env:FILE_MAX_SIZE_BYTES = "52428800"
$env:VITE_API_PROXY_TARGET = "http://localhost:3000"
$env:WORKER_POLL_INTERVAL_MS = "1000"
$env:WEB_ADMIN_SEED_ADMIN_PASSWORD = "change-me-local-1"
pnpm db:migrate
pnpm seed
pnpm dev
```

Open:

```text
http://localhost:5173/login
```

Default seeded account:

```text
Username: admin
Password: change-me-local-1
```

The `pnpm dev` command starts API, web, and worker processes. `WORKER_POLL_INTERVAL_MS=1000` lets durable queue, scheduler, notification dispatch, export, and cleanup behavior execute during the manual check.

## Browser Acceptance Checklist

Login and shell:

- Login with the seeded administrator.
- Confirm the left sidebar and top bar render.
- Confirm breadcrumb, tab navigation, dark mode, full-screen mode, theme color settings, current organization selector, and logout are available.
- Switch to another enabled organization only if one exists; the menu and permission context should refresh.

Core management:

- Open User management and confirm the list loads. Create/edit/status/reset/delete actions should be visible according to permissions.
- Open Organization management and confirm the tree/list loads. Create/edit/enable/disable/delete actions should preserve the materialized-path organization behavior.
- Open Role management and confirm role list, create/edit/enable/disable/copy/delete, permission assignment, data permission, field permission, and user override related surfaces that exist in the page are reachable.
- Open Permission management and confirm permission metadata/tree and sync actions load.
- Open Menu management and confirm menu list/tree, create/edit/delete, and API binding behavior are reachable.

System management:

- Open System configuration and confirm existing editable global configuration records can be viewed and edited.
- Open Dictionary management and confirm dictionary types and items can be listed, created, updated, enabled, and disabled.
- Open i18n messages and confirm existing persisted messages can be listed and edited.

Operations and logs:

- Open Online users and confirm active login-session data loads.
- Open Task scheduler and confirm scheduled task list, create/update, enable/disable, and manual run actions are reachable.
- Open Import/export task list and confirm task list/detail and CSV export task creation are reachable.
- Open login, operation, access, API call, exception, security, scheduler, and file operation logs. Each log page should load and support the implemented search/export pattern.

Files and notifications:

- Open File management and confirm file metadata list, upload, detail, download, image preview, reference display, and delete-invalidate behavior are reachable.
- Open Announcements and confirm list/create/edit/publish/unpublish behavior is reachable.
- Open In-app notifications and confirm unread/read/archive/delete behavior is reachable for current-user notifications.
- Open Notification templates and confirm template list/create/edit behavior is reachable.
- Open Webhooks and confirm list/create/edit/enable/disable behavior is reachable. Persisted webhook secrets must not be displayed as raw values.

Account:

- Open Personal center and confirm profile data loads from the API.
- Open Password change and confirm the form is available.
- Open Personal settings and confirm language, dark mode, theme color, and tab-navigation preferences persist.

API documentation:

- Open `http://localhost:3000/api/openapi.json`.
- Confirm implemented APIs are documented and no SQL Server, example business-module, or mandatory optional-integration surface is exposed.

## Acceptance Evidence

Record the following when using this checklist for release or handoff:

- Commit hash under test.
- Date and operating system.
- Node.js and pnpm versions.
- Database mode: SQLite local/demo or PostgreSQL integration.
- Whether `pnpm verify` passed.
- Whether `pnpm smoke:local` passed.
- Manual browser pages checked.
- Any deviations, linked to `docs/known_gaps.md` when they are reserved or environment-dependent.

## Cleanup

Stop the development processes and remove local demo data if it is no longer needed:

```powershell
Remove-Item -Recurse -Force .\data
Remove-Item -Recurse -Force .\.tmp
```

Both paths are ignored by git.
