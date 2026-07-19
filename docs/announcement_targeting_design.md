# Organization-Scoped Announcement Design

This document records the confirmed implementation contract for completing organization-scoped Announcements. It complements ADR 0004 and describes work that is not yet implemented.

## Scope

Complete system-wide and organization-based Announcement publishing without adding role-based or user-based audiences. Add durable targets, lifecycle enforcement, current-user visibility, management filtering, the user-facing Announcement entry, OpenAPI coverage, and tests.

Announcement publication only changes Announcement lifecycle and visibility. It does not create in-app Notification records, email deliveries, SMS deliveries, Webhook deliveries, or per-user recipient rows.

## Domain Contract

An Announcement has one scope:

- `system`: visible independently of the current Organization and has no Announcement Targets.
- `organization`: has one or more Announcement Targets.

One Announcement Target identifies one enabled, non-deleted Organization and includes that Organization's complete descendant subtree. One Announcement may have multiple targets, but the target set must be minimal:

- Duplicate Organization IDs are invalid.
- Selecting both an ancestor and any of its descendants is invalid.
- The server performs final validation; it does not silently normalize invalid input.

Organization paths remain the existing BIGINT materialized paths. No `parent_id` is added, and Organization nodes remain immovable in v1.

## Lifecycle

Announcement states remain `draft`, `published`, and `deleted`.

- Creation produces a `draft`.
- Only a `draft` may change title, content, scope, targets, or expiration.
- Publish is immediate and records the server's current UTC time in `publishedAt`.
- A `published` Announcement cannot be patched. It must first be unpublished to `draft`.
- Republishing the same Announcement records a new actual `publishedAt`.
- Only a `draft` may be deleted. A published Announcement must first be unpublished.
- Delete is a soft delete that sets `status = deleted`, `is_deleted`, `deleted_at`, and `deleted_by`.

An optional `expiresAt` is editable while the Announcement is a draft. Publish rejects an expiration that is not later than the server's current time. Expiration does not mutate `status`; an expired published Announcement remains available in the management history but is excluded from Current Announcements. No publication or expiration scheduler is added.

Before publishing, the service revalidates title, content, scope, targets, target Organization state, target minimality, and expiration in the same transaction that changes publication state.

## Organization State Changes

New or changed targets must reference enabled, non-deleted Organizations. Target relationships remain stored when an Organization is later disabled or soft deleted so management history remains auditable.

A disabled Organization cannot be selected as the current Organization, so its scoped Announcements are not exposed through Current Announcements. If that Organization is later re-enabled and the Announcement remains published and unexpired, visibility resumes. The target relationship is not rewritten.

## Visibility

Current Announcements are calculated at read time from:

- authenticated User context;
- the User's current Organization;
- Announcement status and expiration;
- system scope or matching target Organization subtree.

Membership and current-Organization changes therefore take effect on the next read. A User who later joins a covered Organization can see still-published Announcements; a User who leaves or switches context cannot. Overlapping target matches return an Announcement once.

No recipient snapshot, read state, archive state, or per-user Announcement delivery is introduced. Those concepts belong to in-app Notifications rather than Announcements.

## Persistence

Extend both SQLite and PostgreSQL schemas and migrations:

- Add nullable UTC `expire_at` to `announcements`.
- Add `announcement_targets` with database auto-increment `id`, `announcement_id`, `target_type`, and `target_id`.
- Restrict `target_type` to `organization` for the confirmed v1 scope.
- Enforce uniqueness for `announcement_id + target_type + target_id`.

Target rows are retained when an Announcement is soft deleted. Announcement creation/update and target replacement are transactional. Publish validation and lifecycle mutation are transactional. All API JSON IDs remain strings.

## API Contracts

Create and update contracts expose:

- `title`
- `content`
- `scopeType`
- `targetOrganizationIds`
- `expiresAt`

Create rules:

- `scopeType = system` requires `targetOrganizationIds` to be omitted or empty.
- `scopeType = organization` requires at least one target Organization ID.
- `expiresAt` is optional and nullable.

Patch rules:

- Fields are optional and `expiresAt = null` clears expiration.
- Omitting `targetOrganizationIds` retains existing targets when scope remains `organization`.
- Changing from `system` to `organization` requires targets in the same request.
- Changing to `system` clears targets and requires a submitted target array, if present, to be empty.
- Any patch against a published Announcement is rejected.

Announcement responses always include `targetOrganizationIds` and `expiresAt`. A system Announcement returns an empty target array.

## Endpoints

Management endpoints:

| Method   | Path                               | Permission             | Purpose                                   |
| -------- | ---------------------------------- | ---------------------- | ----------------------------------------- |
| `GET`    | `/api/announcements`               | `announcement:view`    | Paginated Announcement Catalog.           |
| `POST`   | `/api/announcements`               | `announcement:create`  | Create a draft.                           |
| `PATCH`  | `/api/announcements/:id`           | `announcement:update`  | Update a draft.                           |
| `POST`   | `/api/announcements/:id/publish`   | `announcement:publish` | Immediately publish a valid draft.        |
| `POST`   | `/api/announcements/:id/unpublish` | `announcement:publish` | Return a published Announcement to draft. |
| `DELETE` | `/api/announcements/:id`           | `announcement:delete`  | Soft delete a draft.                      |

The delete endpoint resolves the PRD/design-route discrepancy in favor of the PRD operation and the existing soft-delete model.

Current-user endpoint:

| Method | Path                         | Permission         | Purpose                                    |
| ------ | ---------------------------- | ------------------ | ------------------------------------------ |
| `GET`  | `/api/announcements/current` | Authenticated User | Paginated, distinct Current Announcements. |

The current endpoint does not require management permission. Visibility rules are its data boundary.

## Listing

The Announcement Catalog accepts:

- `page`, default `1`;
- `pageSize`, default `20`, maximum `100`;
- `status`;
- `scopeType`;
- `publishedFrom`;
- `publishedTo`.

Publication-time boundaries are inclusive UTC instants. The Catalog orders by `updatedAt DESC, id DESC` and excludes soft-deleted rows from its ordinary response.

Current Announcements accept `page` and `pageSize` with the same bounds. They order by `publishedAt DESC, id DESC`, return only published and unexpired records visible in the current Organization context, and return `{ items, page, pageSize, total }`.

No title keyword search is added in this goal because it is not confirmed by the specifications.

## Frontend

Extend the existing Announcement management page:

- Add a multi-select Organization tree for organization scope.
- Disable deleted or disabled Organizations.
- Make parent selection represent its complete subtree and prevent redundant descendant submission.
- Add expiration editing, list filters, pagination, delete action, and lifecycle-aware action visibility.
- Do not allow edit or delete actions on published Announcements.

Add an Announcement icon button to the top bar near the current Organization selector. It opens a side panel backed by `/api/announcements/current`, shows title, publication time, scope, and content detail, and supports paginated loading. Announcements have no unread badge because they have no per-user read state.

Switching the current Organization clears and reloads the Current Announcements query. The existing left-navigation Announcement route remains the management page and remains guarded by `announcement:view`.

## Permissions And Manifests

Keep existing Announcement permissions and add the PRD-confirmed `announcement:delete`. Add API manifest and explicit OpenAPI request, query, paginated response, entity response, lifecycle error, and delete response coverage for every endpoint. Preserve Hono RPC inference for frontend internal access.

The current-user endpoint requires authentication but no management permission. It must not expose drafts, deleted records, expired records, or Announcements outside the current Organization's visibility.

## Verification

Add in-memory service and route tests, SQLite migration smoke coverage, PostgreSQL persistence/integration tests, manifest/OpenAPI consistency tests, Hono RPC inference checks, and frontend component tests.

Coverage must include:

- system and multi-Organization target creation;
- duplicate and ancestor/descendant target rejection;
- disabled/deleted target rejection on save and publish;
- transactional target replacement and reload;
- draft-only edit/delete and publish/unpublish/republish transitions;
- expiration validation and current-list exclusion;
- system, exact Organization, descendant, unrelated Organization, and overlapping-target visibility;
- visibility changes after current-Organization switch and membership changes;
- target-history retention after Organization or Announcement soft deletion;
- management filters, pagination, deterministic ordering, and string IDs;
- permission enforcement for management endpoints and authenticated access for Current Announcements;
- frontend target selection, lifecycle actions, empty/loading/error/permission states, and top-bar reload after Organization switch.

## Explicitly Out Of Scope

- Role-based or user-based Announcement targets
- Recipient snapshots or fan-out rows
- Announcement read/unread or archive state
- Scheduled publication or expiration jobs
- Approval workflow
- Automatic in-app, email, SMS, or Webhook delivery
- Organization movement
- Title keyword search
