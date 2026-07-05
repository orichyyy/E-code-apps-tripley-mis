# Web Admin Base System PRD

**Document Type:** Product Requirements Document (PRD)  
**Product:** Web Admin Base System  
**Output Language:** English  
**Current Scope:** Base system only; no sample business module  
**Document Version:** v1.0  
**Date:** 2026-07-01

---

## 1. Document Purpose

This PRD defines the requirements for a reusable **Web Admin Base System**. The system is intended to serve as the foundation for future administrative systems. Future business modules should be added on top of this base without rebuilding common capabilities such as authentication, user management, organization management, permission management, logs, file management, notifications, system configuration, dictionary management, scheduling, import/export, internationalization, and observability.

The document focuses on product requirements and includes technical appendices for API and data model planning.

---

## 2. Scope Summary

### 2.1 In Scope

The first version must include all base modules listed below:

1. Login and logout
2. User management
3. Role management
4. Permission management
5. Menu management
6. Organization management
7. Operation logs
8. Access logs
9. System configuration
10. Dictionary management
11. File upload and file management
12. Announcements
13. In-app notifications
14. Email notifications
15. Webhook notifications
16. SMS channel abstraction and SMS templates, reserved only
17. Personal center
18. Password change
19. Login logs
20. API call logs
21. Scheduled tasks
22. Exception logs
23. Security logs
24. Job execution logs
25. File operation logs
26. Generic import/export framework
27. Internationalization
28. Online user viewing
29. Initialization wizard and seed mechanism
30. Observability foundation
31. Business module extension specification

### 2.2 Out of Scope for Version 1

The following items are explicitly out of scope for the first version:

1. Sample business module.
2. Asset management example module.
3. Tenant management UI and tenant management APIs.
4. Position/job management implementation. The model should reserve extension space only.
5. SSO implementation. Only SSO extension should be reserved.
6. MFA/2FA implementation. Only future extension should be reserved.
7. Self-service password recovery. The first version only supports administrator password reset.
8. SMS sending implementation. Only SMS templates and SMS channel abstraction are reserved.
9. Excel import/export in the first version. Version 1 uses CSV; Excel is reserved for future versions.
10. Kicking online users offline. Version 1 only supports viewing online users; kick-out is reserved.
11. Tablet and mobile responsive optimization. Version 1 targets desktop admin usage.
12. PDF preview. PDF files may be uploaded according to the whitelist, but PDF preview is not required.
13. Organization-level system configuration and organization-level dictionary override. These are reserved only.
14. Explicit backend runtime compatibility requirements. This PRD does not define runtime compatibility requirements.

---

## 3. Product Positioning

The product is a **multi-organization web administration base system**. It is not a SaaS multi-tenant system in the first version, but the data model must reserve `tenant_id` for future expansion.

The system supports hierarchical organizations. A user may belong to multiple organizations, and the user's role may be different in each organization. After login, the user enters the primary organization by default and can switch organizations from the top-right area of the admin shell. Switching organization must refresh menu permissions, button permissions, API permissions, data permissions, and field permissions.

---

## 4. Confirmed Technology Context

The PRD is primarily product-oriented, but the following implementation context has been confirmed:

| Area          | Requirement                                                             |
| ------------- | ----------------------------------------------------------------------- |
| Frontend      | React + shadcn/ui + Tailwind CSS + Zustand                              |
| Backend       | Hono                                                                    |
| Database      | Must support at least PostgreSQL and SQL Server                         |
| API base path | Version 1 uses `/api`; the design must allow future `/api/v2` expansion |
| PRD output    | English                                                                 |

No explicit backend runtime compatibility requirements are included in this PRD.

---

## 5. Goals and Non-Goals

### 5.1 Goals

1. Provide a reusable admin base for future management systems.
2. Provide a complete organization-based permission foundation.
3. Support menu, page, action, API, data, and field-level permissions.
4. Support users belonging to multiple organizations, with one role per organization.
5. Support partial data isolation by organization and global shared data where needed by future modules.
6. Provide complete auditability through login, operation, access, API, exception, security, job, and file operation logs.
7. Provide generic import/export, file upload, notification, scheduled task, dictionary, and system configuration capabilities.
8. Provide a consistent extension specification so future business modules can integrate with base permissions, logs, data scopes, field permissions, files, import/export, and internationalization.

### 5.2 Non-Goals

1. The product is not a complete business system by itself.
2. Version 1 does not include any sample business module.
3. Version 1 does not implement full SaaS tenant management.
4. Version 1 does not implement SSO, MFA, SMS sending, or self-service password recovery.
5. Version 1 does not define mobile-first or tablet-first UX.

---

## 6. User Roles

The system must initialize the following built-in roles:

| Role                       | Description                                                                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Super Administrator        | Not restricted by organization. Can manage all organizations, users, roles, permissions, data, configuration, logs, and system resources. |
| Organization Administrator | Manages users, organization resources, and assigned permissions within the authorized organization scope.                                 |
| Normal User                | Uses assigned menus, pages, operations, and data according to the role in the current organization.                                       |

Roles are not separated into system-level roles and organization-level roles. Permission scope is controlled by permission configuration and data permission rules.

---

## 7. Information Architecture

### 7.1 Top-Level Navigation

The first version should use a classic desktop admin layout:

1. Left-side menu
2. Top bar
3. Breadcrumb navigation
4. Optional page tabs
5. Fullscreen mode
6. Dark mode
7. Theme color configuration
8. Desktop admin experience only

### 7.2 Page Tabs

Page tabs must be enabled by default. A user can disable page tabs in personal settings. When disabled, the system behaves as a typical single-page application navigation experience.

### 7.3 Recommended Menu Structure

```text
Dashboard
System Management
  Organizations
  Users
  Roles
  Permissions
  Menus
  System Configuration
  Dictionaries
Security & Audit
  Login Logs
  Operation Logs
  Access Logs
  API Logs
  Exception Logs
  Security Logs
Files
  File Management
Notifications
  Announcements
  In-App Notifications
  Notification Templates
  Webhooks
Jobs
  Scheduled Tasks
  Job Execution Logs
Import & Export
  Import/Export Tasks
Personal
  Profile
  Password
  Preferences
```

The final display of each menu item must be controlled by menu permissions.

---

## 8. Global Business Rules

### 8.1 Organization Context

1. A user may belong to multiple organizations.
2. A user must have one primary organization.
3. A user can have only one role in the same organization.
4. The same user may have different roles in different organizations.
5. After login, the system enters the user's primary organization by default.
6. The user may switch the current organization from the top-right organization selector.
7. Switching organization must refresh:
   - Menu permissions
   - Page permissions
   - Button/action permissions
   - API permissions
   - Data permissions
   - Field permissions
8. A disabled organization cannot be selected as the current organization.
9. If a disabled organization's user still belongs to another enabled organization, the user may still log in and switch to another enabled organization.

### 8.2 Tenant Reservation

1. Version 1 does not provide tenant management.
2. Core data models must reserve `tenant_id` for future multi-tenant expansion.
3. Tenant-related UI, APIs, and operational workflows are out of scope for Version 1.

### 8.3 Logical Deletion

User deletion must use logical deletion. Other core entities should also support logical deletion where deletion can affect auditability or historical relationships.

### 8.4 Auditability

All security-sensitive and administration-sensitive actions must generate logs. Logs must contain enough context to support troubleshooting and audit review.

---

## 9. Authentication and Account Security

### 9.1 Login Methods

Version 1 must support:

1. Username + password login
2. Logout
3. SSO extension reservation only

Email login, phone login, email verification code login, and phone verification code login are not required unless implemented as future extensions.

### 9.2 Authentication Token Strategy

The backend authentication method must use:

1. JWT Access Token
2. Refresh Token

Access Token and Refresh Token expiration policies must be configurable. The PRD does not define fixed default expiration values.

### 9.3 Login Flow

1. User opens login page.
2. User enters username and password.
3. System validates credentials.
4. System checks whether the account is enabled, disabled, locked, or logically deleted.
5. System checks whether the account has at least one enabled organization.
6. If login succeeds, the system enters the user's primary organization by default.
7. If the primary organization is disabled, the system must guide the user to select another enabled organization, if available.
8. If the user has no enabled organization, login must be denied.
9. System records login log and security log where applicable.

### 9.4 Password Rules

The password policy must support configuration. The default password complexity rule is:

1. Minimum 8 characters
2. Must contain letters and numbers

The system must support:

1. First login forced password change
2. Periodic password change
3. Default periodic password change cycle: 365 days
4. Administrator password reset
5. No self-service password recovery in Version 1

### 9.5 Login Failure Locking

The login failure locking rule must be configurable by administrators. At minimum, the configuration must support:

1. Maximum consecutive failed attempts
2. Lock duration
3. Unlock by time expiration
4. Unlock by administrator action

### 9.6 Online Users

Version 1 must support viewing current online users. Kicking users offline is not implemented in Version 1 and is reserved for future versions.

### 9.7 MFA/2FA

MFA/2FA is not implemented in Version 1. The PRD must reserve extension space for future support.

---

## 10. Organization Management

### 10.1 Purpose

Organization management provides the hierarchical structure used for user assignment, permission context, and data scope control.

### 10.2 Organization Tree Rules

1. Organizations use a tree structure.
2. Multiple root nodes are allowed.
3. System initialization must create one default root organization.
4. Maximum organization tree depth must be configurable.
5. Disabling a parent organization automatically disables all child organizations.
6. A disabled organization cannot be selected as the current organization.
7. Historical data under a disabled organization is retained and queryable.
8. New data cannot be created under a disabled organization.

### 10.3 Organization Fields

| Field               |    Required | Description                                        |
| ------------------- | ----------: | -------------------------------------------------- |
| Organization Name   |         Yes | Display name of the organization                   |
| Organization Code   |         Yes | Unique organization code within the relevant scope |
| Parent Organization | Conditional | Empty for root organization                        |
| Owner               |          No | Responsible user/person                            |
| Phone               |          No | Contact phone                                      |
| Email               |          No | Contact email                                      |
| Address             |          No | Organization address                               |
| Sort Order          |          No | Display order in tree                              |
| Status              |         Yes | Enabled or disabled                                |
| Remark              |          No | Additional notes                                   |
| Created At          |         Yes | Creation time                                      |
| Updated At          |         Yes | Last update time                                   |

### 10.4 Organization Operations

| Operation              | Description                                  | Permission Code Example        |
| ---------------------- | -------------------------------------------- | ------------------------------ |
| View Organization Tree | View organization hierarchy                  | `organization:view`            |
| Create Organization    | Create child or root organization            | `organization:create`          |
| Edit Organization      | Edit organization fields                     | `organization:update`          |
| Disable Organization   | Disable organization and child organizations | `organization:disable`         |
| Enable Organization    | Enable organization when rules allow         | `organization:enable`          |
| Delete Organization    | Logical delete when allowed                  | `organization:delete`          |
| Configure Max Depth    | Configure tree maximum depth                 | `organization:depth:configure` |

### 10.5 Business Rules

1. Organization code must be unique within the applicable scope.
2. A parent organization cannot be selected if it would exceed the configured maximum tree depth.
3. A disabled organization cannot receive new users, new role bindings, or new business data.
4. If a user belongs only to disabled organizations, the user cannot log in.
5. If a user belongs to multiple organizations and at least one organization is enabled, the user can log in and use enabled organizations only.

### 10.6 Acceptance Criteria

1. Given an administrator has organization permissions, when the administrator creates an organization with valid fields, then the organization appears in the tree.
2. Given the maximum depth is configured, when an administrator attempts to create a child organization beyond the limit, then the system rejects the action.
3. Given a parent organization is disabled, when the action succeeds, then all child organizations are also disabled.
4. Given an organization is disabled, when a user tries to switch to it, then the system prevents the switch.
5. Given historical data exists under a disabled organization, when an authorized user queries history, then the data remains queryable.

---

## 11. User Management

### 11.1 Purpose

User management controls system accounts, organization membership, role assignment, account status, and basic profile information.

### 11.2 User Fields

| Field                 | Required | Description                                   |
| --------------------- | -------: | --------------------------------------------- |
| Username              |      Yes | Login identifier; administrator may modify it |
| Name / Nickname       |      Yes | User display name                             |
| Email                 |      Yes | Must be unique                                |
| Phone Number          |      Yes | Must be unique                                |
| Avatar                |       No | Linked file resource                          |
| Gender                |       No | User gender field                             |
| Employee Number       |       No | Internal employee number                      |
| Organization List     |      Yes | Organizations the user belongs to             |
| Primary Organization  |      Yes | Default organization after login              |
| Role per Organization |      Yes | One role per organization                     |
| Status                |      Yes | Enabled, disabled, locked                     |
| Remark                |       No | Additional notes                              |
| Last Login Time       |       No | Updated after successful login                |
| Created At            |      Yes | Creation time                                 |
| Updated At            |      Yes | Last update time                              |
| Created By            |      Yes | Creator user                                  |
| Updated By            |      Yes | Last updater user                             |

### 11.3 User Operations

| Operation      | Description                                       | Permission Code Example |
| -------------- | ------------------------------------------------- | ----------------------- |
| View User List | Query users by keyword, status, organization      | `user:view`             |
| Create User    | Create a new user                                 | `user:create`           |
| Edit User      | Edit user profile, username, organizations, roles | `user:update`           |
| Disable User   | Disable account                                   | `user:disable`          |
| Enable User    | Enable account                                    | `user:enable`           |
| Lock User      | Lock account                                      | `user:lock`             |
| Unlock User    | Unlock account                                    | `user:unlock`           |
| Reset Password | Administrator resets password                     | `user:password:reset`   |
| Delete User    | Logical delete                                    | `user:delete`           |
| Import Users   | CSV import                                        | `user:import`           |
| Export Users   | CSV export                                        | `user:export`           |

### 11.4 Business Rules

1. Email must be unique.
2. Phone number must be unique.
3. Username may be modified by administrators.
4. User deletion must be logical deletion.
5. A user must have at least one organization before being able to log in.
6. A user must have one primary organization.
7. A user can have only one role in the same organization.
8. A user may have different roles in different organizations.
9. If a user's primary organization is disabled, the user must use another enabled organization if available.
10. A disabled, locked, or logically deleted user cannot log in.

### 11.5 Acceptance Criteria

1. Given an administrator creates a user with a duplicate email, when the form is submitted, then the system rejects it.
2. Given an administrator creates a user with a duplicate phone number, when the form is submitted, then the system rejects it.
3. Given a user belongs to multiple organizations, when the user logs in, then the primary organization is selected by default.
4. Given the user switches organization, when the switch succeeds, then menus, actions, APIs, data permissions, and field permissions are reloaded.
5. Given a user is logically deleted, when the user attempts login, then the system denies login.

---

## 12. Role Management

### 12.1 Purpose

Role management provides reusable permission bundles that can be assigned to users in specific organizations.

### 12.2 Role Fields

| Field          | Required | Description                                          |
| -------------- | -------: | ---------------------------------------------------- |
| Role Name      |      Yes | Display name                                         |
| Role Code      |      Yes | Unique code                                          |
| Status         |      Yes | Enabled or disabled                                  |
| Permission Set |      Yes | Menu, page, action, API, data, and field permissions |
| Remark         |       No | Additional notes                                     |
| Created At     |      Yes | Creation time                                        |
| Updated At     |      Yes | Last update time                                     |

### 12.3 Role Operations

| Operation             | Description                                   | Permission Code Example   |
| --------------------- | --------------------------------------------- | ------------------------- |
| View Roles            | Query role list                               | `role:view`               |
| Create Role           | Create role                                   | `role:create`             |
| Edit Role             | Edit role metadata                            | `role:update`             |
| Copy Role             | Copy role and permission configuration        | `role:copy`               |
| Configure Permissions | Configure role permissions                    | `role:permissions:update` |
| Enable/Disable Role   | Change role status                            | `role:status:update`      |
| Delete Role           | Delete or logically delete role where allowed | `role:delete`             |

### 12.4 Business Rules

1. The system does not separate system-level roles and organization-level roles.
2. Role scope is controlled through data permission configuration.
3. Role code must be unique within the relevant scope.
4. Copying a role must copy its permission configuration.
5. A disabled role cannot be assigned to new user-organization relationships.

### 12.5 Acceptance Criteria

1. Given an administrator copies a role, when the copy succeeds, then the new role contains the same permission configuration as the source role.
2. Given a role is disabled, when an administrator assigns roles to a user in an organization, then the disabled role is not selectable.
3. Given a role permission is updated, when a user with that role refreshes or switches organization, then the updated permissions take effect.

---

## 13. Permission Management

### 13.1 Permission Model

The system must use an RBAC-based permission model with custom data permission rules.

The system must support the following permission dimensions:

1. Menu permission
2. Page permission
3. Action/button permission
4. API permission
5. Data permission
6. Field permission

### 13.2 Permission Conflict Resolution

When multiple permission sources apply, the priority order is:

```text
User permission > Role permission > Organization permission > System default permission
```

### 13.3 Data Permission Scope

Data permission rules must support all of the following scopes:

1. Own data only
2. Current organization data
3. Current organization and child organizations data
4. Specified organizations
5. All data
6. User-based custom scope
7. Role-based custom scope
8. Resource-type-based scope
9. Expression/rule-based configuration, such as `created_by = current_user` or `org_id in selected_orgs`

### 13.4 Data Permission Configuration Method

The system must support the following configuration model:

1. Developers define selectable data permission rules in code.
2. Administrators configure and combine those rules visually in the admin UI.
3. The UI must not require administrators to directly write unsafe arbitrary code.
4. Rules must be resource-aware so different modules can have different data permission scopes.

### 13.5 Field Permission Scenarios

Field-level permissions must support the following scenarios:

1. List page field visibility
2. Detail page field visibility
3. Create form field visibility
4. Edit form field visibility
5. Edit form field editability
6. Exported file field visibility
7. API response field availability

### 13.6 Field Permission Scope

Field-level permissions apply to:

1. Future business modules
2. Sensitive system modules, including user management

### 13.7 Permission Operations

| Operation                          | Description                                | Permission Code Example   |
| ---------------------------------- | ------------------------------------------ | ------------------------- |
| View Permission Tree               | View permission resources                  | `permission:view`         |
| Configure Role Permissions         | Assign permissions to a role               | `permission:role:update`  |
| Configure User Permission Override | Configure user-level override              | `permission:user:update`  |
| Configure Data Rules               | Configure data permission rules            | `permission:data:update`  |
| Configure Field Rules              | Configure field permission rules           | `permission:field:update` |
| Sync API Permissions               | Scan backend APIs and generate identifiers | `permission:api:sync`     |

### 13.8 Acceptance Criteria

1. Given a user has menu permission removed, when the user reloads the system, then the menu is no longer visible.
2. Given a user does not have button permission, when the page is opened, then the button is hidden or disabled.
3. Given a user lacks API permission, when the API is called directly, then the backend denies the request.
4. Given a data permission rule limits the user to current organization data, when the user queries a resource, then only current organization data is returned.
5. Given a field permission hides a sensitive field, when the user views list, detail, export, or API response, then the field is not exposed.

---

## 14. Menu Management

### 14.1 Purpose

Menu management controls admin navigation, page access, buttons/actions, and API permission binding.

### 14.2 Menu Capabilities

The system must support:

1. Menu hierarchy
2. Menu name
3. Menu icon
4. Sort order
5. Visibility control
6. Route metadata required by the frontend
7. Page permission identifier
8. Button/action permission identifiers
9. API permission identifiers
10. Binding API identifiers to menu or action permission nodes

### 14.3 API Permission Identifier Management

Backend APIs must be automatically scanned to generate API permission identifiers. Administrators can then bind API permission identifiers to menus, pages, or actions.

### 14.4 Menu Operations

| Operation         | Description                              | Permission Code Example |
| ----------------- | ---------------------------------------- | ----------------------- |
| View Menu Tree    | View menu and permission tree            | `menu:view`             |
| Create Menu       | Create menu node                         | `menu:create`           |
| Edit Menu         | Edit menu metadata                       | `menu:update`           |
| Delete Menu       | Delete menu node where allowed           | `menu:delete`           |
| Configure Actions | Add or edit button/action permissions    | `menu:action:update`    |
| Bind APIs         | Bind API identifiers to permission nodes | `menu:api:bind`         |
| Sort Menus        | Update display order                     | `menu:sort`             |

### 14.5 Acceptance Criteria

1. Given an administrator creates a menu with a permission code, when assigned to a role, then users with that role can see the menu.
2. Given an API is scanned, when the scan completes, then the API identifier appears in the binding list.
3. Given an API identifier is bound to an action permission, when a user lacks that action permission, then the backend API call is denied.

---

## 15. System Configuration

### 15.1 Purpose

System configuration provides global configurable parameters for the base system.

### 15.2 Scope

Version 1 supports global configuration only. Organization-level configuration override is reserved for future versions.

### 15.3 Configuration Fields

| Field        | Required | Description                         |
| ------------ | -------: | ----------------------------------- |
| Config Key   |      Yes | Unique key                          |
| Config Value |      Yes | Value                               |
| Value Type   |      Yes | String, number, boolean, JSON, etc. |
| Group        |       No | Configuration group                 |
| Description  |       No | Explanation                         |
| Editable     |      Yes | Whether editable in UI              |
| Status       |      Yes | Enabled or disabled                 |
| Updated At   |      Yes | Last update time                    |

### 15.4 Required Configuration Groups

1. Security settings
2. Password policy
3. Token/session expiration settings
4. Organization tree depth
5. File upload settings
6. Log retention settings
7. Notification settings
8. Internationalization defaults
9. UI theme defaults

### 15.5 Acceptance Criteria

1. Given a configuration is marked non-editable, when an administrator opens the edit UI, then the configuration cannot be modified.
2. Given the organization depth configuration changes, when creating new organizations, then the new limit is enforced.
3. Given log retention settings change, when retention jobs run, then logs are processed according to updated settings.

---

## 16. Dictionary Management

### 16.1 Purpose

Dictionary management provides common enumerations and option lists for the base system and future business modules.

### 16.2 Scope

Version 1 supports global dictionaries only. Organization-level dictionaries are reserved for future versions.

### 16.3 Internationalized Dictionary Data

Dictionary data must support internationalization. At minimum, the system must support Chinese and English labels.

### 16.4 Dictionary Operations

| Operation              | Description                     | Permission Code Example         |
| ---------------------- | ------------------------------- | ------------------------------- |
| View Dictionaries      | View dictionary types and items | `dictionary:view`               |
| Create Dictionary Type | Create type                     | `dictionary:type:create`        |
| Edit Dictionary Type   | Edit type                       | `dictionary:type:update`        |
| Delete Dictionary Type | Delete type where allowed       | `dictionary:type:delete`        |
| Create Dictionary Item | Create item                     | `dictionary:item:create`        |
| Edit Dictionary Item   | Edit item                       | `dictionary:item:update`        |
| Enable/Disable Item    | Change item status              | `dictionary:item:status:update` |

### 16.5 Acceptance Criteria

1. Given a dictionary item has Chinese and English labels, when the user switches language, then the correct label is displayed.
2. Given a dictionary item is disabled, when a form loads options, then the disabled item is not selectable for new data.

---

## 17. File Management

### 17.1 Purpose

File management provides reusable upload, storage, download, preview, permission, and reference tracking capabilities.

### 17.2 Storage Support

Version 1 must support:

1. Local file system storage
2. S3-compatible object storage

For S3-compatible object storage, private bucket access must be supported through backend authentication before download.

### 17.3 Upload Rules

| Rule                           | Requirement          |
| ------------------------------ | -------------------- |
| Default single file size limit | 50 MB                |
| File size configuration        | Must be configurable |
| File type whitelist            | Required             |
| File type blacklist            | Required             |
| Image preview                  | Required             |
| Download permission            | Required             |
| Delete permission              | Required             |
| File reference relationship    | Required             |

### 17.4 Default File Type Whitelist

The default whitelist includes:

1. Images: `jpg`, `jpeg`, `png`, `webp`, `gif`
2. Documents: `pdf`, `doc`, `docx`, `xls`, `xlsx`, `csv`, `txt`
3. Archives: `zip`

### 17.5 File Reference Rules

If a file is referenced by business data or system data, deletion is allowed, but the referencing data must display the file as invalid or unavailable.

### 17.6 File Operations

| Operation       | Description                             | Permission Code Example |
| --------------- | --------------------------------------- | ----------------------- |
| View Files      | Query uploaded files                    | `file:view`             |
| Upload File     | Upload file                             | `file:upload`           |
| Download File   | Download file after permission check    | `file:download`         |
| Preview Image   | Preview image files                     | `file:preview`          |
| Delete File     | Delete file and mark references invalid | `file:delete`           |
| View References | View file reference relationship        | `file:references:view`  |

### 17.7 Acceptance Criteria

1. Given a file exceeds 50 MB by default, when uploaded, then the system rejects it unless the configured limit has been changed.
2. Given a file type is not in the whitelist, when uploaded, then the system rejects it.
3. Given a user lacks download permission, when requesting file download, then the system denies access.
4. Given a referenced file is deleted, when related data is viewed, then the file is displayed as invalid or unavailable.

---

## 18. Notifications and Announcements

### 18.1 Purpose

The system provides announcements, in-app notifications, email notifications, webhook notifications, and reserved SMS notification abstraction.

### 18.2 Supported Channels

| Channel             | Version 1 Requirement                                                   |
| ------------------- | ----------------------------------------------------------------------- |
| Announcement        | Implement                                                               |
| In-app notification | Implement                                                               |
| SMTP email          | Implement                                                               |
| Webhook             | Implement                                                               |
| SMS                 | Do not send in Version 1; reserve SMS templates and channel abstraction |

### 18.3 Announcement Scope

Announcements must support:

1. System-wide publishing
2. Organization-based publishing

Role-based and user-based announcement scopes are not required in Version 1.

### 18.4 In-App Notification States

In-app notifications must support:

1. Unread
2. Read
3. Archived
4. Deleted

### 18.5 Notification Templates

The system must support templates for:

1. In-app notifications
2. Email notifications
3. SMS notifications, reserved only

Templates must support:

1. Multiple languages
2. Template variables, such as `{userName}` and `{taskName}`

### 18.6 Webhook Requirements

Webhooks must support two purposes:

1. Notification sending channel, such as pushing notifications to external systems
2. System event subscription mechanism, such as user creation, task failure, permission change, and other system events

### 18.7 Notification Operations

| Operation            | Description                  | Permission Code Example        |
| -------------------- | ---------------------------- | ------------------------------ |
| Publish Announcement | Publish announcement         | `announcement:publish`         |
| Edit Announcement    | Edit draft announcement      | `announcement:update`          |
| Delete Announcement  | Delete announcement          | `announcement:delete`          |
| View Notifications   | View in-app notifications    | `notification:view`            |
| Mark as Read         | Mark notification as read    | `notification:read`            |
| Archive Notification | Archive notification         | `notification:archive`         |
| Delete Notification  | Delete notification          | `notification:delete`          |
| Manage Templates     | Manage templates             | `notification:template:update` |
| Manage Webhooks      | Manage webhook subscriptions | `webhook:update`               |

### 18.8 Acceptance Criteria

1. Given an announcement is published to an organization, when users in that organization log in, then they can view the announcement.
2. Given a user marks a notification as read, when the notification list refreshes, then the status is read.
3. Given a multilingual email template exists, when an email is sent to a user with English preference, then the English template is used.
4. Given a webhook subscription exists for a system event, when the event occurs, then the webhook delivery task is created.

---

## 19. Logs and Audit

### 19.1 Log Types

The system must support the following log types:

1. Login logs
2. Operation logs
3. Access logs
4. API call logs
5. Exception logs
6. Security logs
7. Scheduled task execution logs
8. File operation logs

### 19.2 Log Retention

1. Different log types must support different retention periods.
2. All log types default to 90 days.
3. Each log type may be adjusted separately.
4. Retention processing should be executed by scheduled jobs.

### 19.3 Log Export

1. Log export must use CSV in Version 1.
2. All log exports must run as asynchronous export tasks.
3. Export access must be permission-controlled.

### 19.4 API Call Log Strategy

API logging must support per-interface configurable log levels:

1. None
2. Basic information only
3. Request parameters
4. Request parameters + response content

Sensitive fields must always be masked, regardless of log level.

### 19.5 Sensitive Field Masking

At minimum, the following fields must be treated as sensitive:

1. Passwords
2. Tokens
3. Authorization headers
4. Refresh tokens
5. Phone numbers
6. Email addresses
7. Any configured sensitive field

### 19.6 Log Query Fields

Each log list should support search and filtering by relevant fields, such as:

1. User
2. Organization
3. Time range
4. IP address
5. Operation type
6. Resource type
7. Status
8. Trace ID / Request ID

### 19.7 Acceptance Criteria

1. Given a user logs in successfully, when logs are queried, then a login log entry exists.
2. Given an administrator modifies a role, when operation logs are queried, then the role update operation is recorded.
3. Given an API log level is set to request + response, when the API is called, then request and response content are recorded with sensitive fields masked.
4. Given a log export is requested, when the export starts, then an asynchronous export task is created.
5. Given the log retention job runs, when logs exceed their configured retention period, then logs are processed according to retention policy.

---

## 20. Scheduled Tasks

### 20.1 Purpose

Scheduled tasks provide system-level background job management for base capabilities such as log retention, notification delivery, import/export processing, and future module jobs.

### 20.2 Required Capabilities

Version 1 must support:

1. Task list
2. Execution logs
3. Cron expression
4. Enable/disable task
5. Manual execution
6. Failure retry
7. Timeout control
8. Distributed lock to avoid duplicate execution in multi-instance deployment
9. Task parameter configuration

### 20.3 Scheduled Task Operations

| Operation           | Description                 | Permission Code Example |
| ------------------- | --------------------------- | ----------------------- |
| View Jobs           | View scheduled task list    | `job:view`              |
| Create Job          | Create a scheduled task     | `job:create`            |
| Edit Job            | Edit task configuration     | `job:update`            |
| Enable/Disable Job  | Change task status          | `job:status:update`     |
| Run Job Manually    | Trigger task manually       | `job:run`               |
| View Execution Logs | View task execution records | `job:log:view`          |

### 20.4 Acceptance Criteria

1. Given a task is disabled, when its scheduled time arrives, then it does not run.
2. Given an administrator manually runs a task, when the action succeeds, then an execution log is created.
3. Given multiple application instances are running, when a scheduled job triggers, then the distributed lock prevents duplicate execution.
4. Given a task fails and retry is configured, when failure occurs, then the system retries according to configuration.

---

## 21. Import and Export Framework

### 21.1 Purpose

The import/export framework provides reusable CSV import and export capabilities for base modules and future business modules.

### 21.2 Version 1 Format

1. Version 1 supports CSV.
2. Excel is reserved for future versions.

### 21.3 Required Capabilities

The framework must support:

1. Import
2. Export
3. Import template download
4. Import validation
5. Error report download
6. Large data asynchronous import tasks
7. Large data asynchronous export tasks
8. Permission-controlled import/export
9. Field-level permission applied to exported fields

### 21.4 Import Flow

1. User downloads import template.
2. User fills CSV file.
3. User uploads CSV file.
4. System validates file format, required fields, dictionary values, uniqueness, and permission constraints.
5. If validation fails, system generates an error report.
6. If validation succeeds, system creates an asynchronous import task.
7. User can view task status and results.

### 21.5 Export Flow

1. User selects export criteria.
2. System checks export permission and field-level permission.
3. System creates asynchronous export task.
4. User downloads the generated CSV after the task succeeds.

### 21.6 Acceptance Criteria

1. Given a user lacks export permission, when the user attempts export, then the system denies the action.
2. Given import data contains invalid rows, when validation runs, then an error report is generated.
3. Given export includes fields hidden by field permission, when the CSV is generated, then those fields are excluded.
4. Given a large import is submitted, when accepted, then the system processes it asynchronously.

---

## 22. Internationalization

### 22.1 Supported Languages

Version 1 must support:

1. Chinese
2. English

### 22.2 Coverage

Internationalization must cover:

1. Frontend UI text
2. Backend error messages
3. Notification templates
4. Dictionary data

### 22.3 Language Selection Rule

1. System administrator can configure the default language.
2. Users can override the default language in personal settings.
3. After login, the user's language preference takes effect.

### 22.4 Acceptance Criteria

1. Given a user sets language to English, when the user reloads the system, then UI text appears in English.
2. Given a backend validation error occurs, when the user language is Chinese, then the error message is returned in Chinese where translation exists.
3. Given dictionary labels exist in Chinese and English, when language changes, then dictionary display labels change accordingly.

---

## 23. Personal Center

### 23.1 Purpose

Personal center allows users to manage their own profile, password, UI preferences, language, theme, and page tab setting.

### 23.2 Required Capabilities

1. View personal profile
2. Update allowed profile fields
3. Change password
4. Upload or change avatar
5. Set language preference
6. Set dark mode preference
7. Set theme color preference
8. Enable or disable page tabs
9. View current organization
10. Switch organization through top-right selector

### 23.3 Acceptance Criteria

1. Given a user changes password successfully, when using the old password, then login fails.
2. Given a user disables page tabs, when navigating pages, then the admin shell behaves as typical SPA navigation.
3. Given a user changes language preference, when the system reloads, then the selected language remains active.

---

## 24. Observability

### 24.1 Required Capabilities

The system must support:

1. Health check endpoint
2. Metrics capability reserved
3. Trace ID / Request ID
4. Structured logs
5. Alert interface reserved

### 24.2 Business Rules

1. Each request should have a Trace ID or Request ID.
2. Logs must include Trace ID / Request ID where applicable.
3. Health check must be available for deployment monitoring.
4. Metrics and alerting interfaces are reserved for integration with future monitoring systems.

### 24.3 Acceptance Criteria

1. Given a request enters the system, when logs are written, then the request ID can be found in related logs.
2. Given the health check endpoint is called, when the service is healthy, then the endpoint returns a healthy status.

---

## 25. Initialization

### 25.1 Required Initialization Mechanisms

Version 1 must support both:

1. First startup initialization wizard
2. Command-line / seed script initialization

### 25.2 Initialization Contents

The initialization mechanism must be able to create or configure:

1. Default root organization
2. Super administrator account
3. Built-in roles
4. Base menus
5. Base permissions
6. Default system configuration
7. Default dictionaries
8. Initial language resources

### 25.3 Acceptance Criteria

1. Given a fresh deployment, when the initialization wizard is completed, then the system can be logged into using the created super administrator account.
2. Given seed initialization is run, when it completes successfully, then base roles, menus, permissions, configuration, and dictionaries are available.
3. Given initialization has already completed, when the wizard is accessed again, then duplicate initialization is prevented.

---

## 26. Business Module Extension Specification

### 26.1 Purpose

Future business modules must be able to integrate directly with the base system. The base system must define extension contracts so modules can plug into permissions, organization context, logs, files, import/export, notifications, i18n, and observability consistently.

### 26.2 Required Integration Points for Future Modules

Each future business module must define or register:

1. Module metadata
2. Menu entries
3. Page routes
4. Action/button permission codes
5. API permission identifiers
6. Data permission resource type
7. Field permission metadata
8. Operation log event definitions
9. API log level defaults
10. Import/export templates and handlers, if applicable
11. File attachment rules, if applicable
12. Notification event definitions, if applicable
13. i18n keys
14. Dictionary dependencies, if applicable
15. Scheduled jobs, if applicable

### 26.3 Base Integration Requirements

A future module must comply with the following requirements:

1. Every protected page must have a page permission.
2. Every protected operation must have an action permission.
3. Every protected API must have an API permission identifier.
4. Every resource requiring data isolation must define a data permission resource type.
5. Every field requiring visibility or editability control must define field permission metadata.
6. Every create, update, delete, import, export, approval-like, or security-sensitive action must produce operation logs.
7. Every file operation must use the base file service.
8. Every import/export operation must use the base import/export task framework.
9. Every user-facing label and error message must support i18n.
10. Every API should include Request ID / Trace ID in logs.

### 26.4 Acceptance Criteria

1. Given a future module registers menu, permission, API, data, and field metadata, when administrators configure a role, then the module permissions are available in the permission UI.
2. Given a future module uses the base data permission mechanism, when a user queries module data, then the returned data respects current organization context and configured data rules.
3. Given a future module exports data, when field permissions hide fields, then the export excludes those fields.
4. Given a future module uploads files, when the file is deleted, then referenced business data displays the file as invalid or unavailable.

---

## 27. Functional Module Requirement Matrix

| Module                  | Pages | Fields | Operations | Permissions | Logs | Acceptance Required |
| ----------------------- | ----: | -----: | ---------: | ----------: | ---: | ------------------: |
| Login/Logout            |   Yes |    Yes |        Yes |         Yes |  Yes |                 Yes |
| User Management         |   Yes |    Yes |        Yes |         Yes |  Yes |                 Yes |
| Organization Management |   Yes |    Yes |        Yes |         Yes |  Yes |                 Yes |
| Role Management         |   Yes |    Yes |        Yes |         Yes |  Yes |                 Yes |
| Permission Management   |   Yes |    Yes |        Yes |         Yes |  Yes |                 Yes |
| Menu Management         |   Yes |    Yes |        Yes |         Yes |  Yes |                 Yes |
| Logs                    |   Yes |    Yes |        Yes |         Yes |  Yes |                 Yes |
| System Configuration    |   Yes |    Yes |        Yes |         Yes |  Yes |                 Yes |
| Dictionary Management   |   Yes |    Yes |        Yes |         Yes |  Yes |                 Yes |
| File Management         |   Yes |    Yes |        Yes |         Yes |  Yes |                 Yes |
| Notifications           |   Yes |    Yes |        Yes |         Yes |  Yes |                 Yes |
| Scheduled Tasks         |   Yes |    Yes |        Yes |         Yes |  Yes |                 Yes |
| Import/Export           |   Yes |    Yes |        Yes |         Yes |  Yes |                 Yes |
| Personal Center         |   Yes |    Yes |        Yes |         Yes |  Yes |                 Yes |
| Initialization          |   Yes |    Yes |        Yes |         Yes |  Yes |                 Yes |

---

## 28. API Draft

### 28.1 API Conventions

Version 1 uses `/api` as the base path. The design must allow future version expansion such as `/api/v2`.

Unless otherwise stated:

1. All protected APIs require authentication.
2. All protected APIs require API permission validation.
3. All responses must include or be traceable by Request ID / Trace ID.
4. Error responses must follow the unified error code specification.
5. Sensitive response fields must respect field-level permission.

### 28.2 Common Response Shape

```json
{
  "success": true,
  "code": "OK",
  "message": "Success",
  "data": {},
  "requestId": "string"
}
```

### 28.3 Common Error Shape

```json
{
  "success": false,
  "code": "AUTH_INVALID_CREDENTIALS",
  "message": "Invalid username or password.",
  "details": {},
  "requestId": "string"
}
```

### 28.4 Authentication APIs

| Method | Path                             | Description                 | Main Request                 | Main Response                                                   |
| ------ | -------------------------------- | --------------------------- | ---------------------------- | --------------------------------------------------------------- |
| POST   | `/api/auth/login`                | Username/password login     | `username`, `password`       | access token, refresh token, user summary, primary organization |
| POST   | `/api/auth/refresh`              | Refresh access token        | refresh token                | new access token, refresh token metadata                        |
| POST   | `/api/auth/logout`               | Logout current session      | none                         | success                                                         |
| GET    | `/api/auth/me`                   | Get current user context    | none                         | user, organizations, current organization, permissions          |
| POST   | `/api/auth/current-organization` | Switch current organization | `organizationId`             | updated organization context and permissions                    |
| POST   | `/api/auth/change-password`      | Change own password         | `oldPassword`, `newPassword` | success                                                         |

### 28.5 User APIs

| Method | Path                             | Description                  | Main Request                      | Main Response   |
| ------ | -------------------------------- | ---------------------------- | --------------------------------- | --------------- |
| GET    | `/api/users`                     | Query users                  | filters, pagination               | paged user list |
| POST   | `/api/users`                     | Create user                  | user fields, organizations, roles | created user    |
| GET    | `/api/users/{id}`                | Get user detail              | path id                           | user detail     |
| PATCH  | `/api/users/{id}`                | Update user                  | changed fields                    | updated user    |
| DELETE | `/api/users/{id}`                | Logical delete user          | path id                           | success         |
| POST   | `/api/users/{id}/enable`         | Enable user                  | path id                           | success         |
| POST   | `/api/users/{id}/disable`        | Disable user                 | path id                           | success         |
| POST   | `/api/users/{id}/lock`           | Lock user                    | path id                           | success         |
| POST   | `/api/users/{id}/unlock`         | Unlock user                  | path id                           | success         |
| POST   | `/api/users/{id}/reset-password` | Administrator reset password | reset mode                        | success         |
| GET    | `/api/users/export`              | Create CSV export task       | filters                           | export task     |
| POST   | `/api/users/import`              | Create CSV import task       | uploaded file id                  | import task     |
| GET    | `/api/users/import-template`     | Download CSV template        | none                              | file            |

### 28.6 Organization APIs

| Method | Path                              | Description                               | Main Request        | Main Response        |
| ------ | --------------------------------- | ----------------------------------------- | ------------------- | -------------------- |
| GET    | `/api/organizations/tree`         | Get organization tree                     | filters             | tree                 |
| POST   | `/api/organizations`              | Create organization                       | organization fields | created organization |
| GET    | `/api/organizations/{id}`         | Get organization detail                   | path id             | organization detail  |
| PATCH  | `/api/organizations/{id}`         | Update organization                       | changed fields      | updated organization |
| POST   | `/api/organizations/{id}/enable`  | Enable organization                       | path id             | success              |
| POST   | `/api/organizations/{id}/disable` | Disable organization and children         | path id             | success              |
| DELETE | `/api/organizations/{id}`         | Logical delete organization where allowed | path id             | success              |
| GET    | `/api/organizations/config/depth` | Get max depth configuration               | none                | max depth            |
| PATCH  | `/api/organizations/config/depth` | Update max depth configuration            | `maxDepth`          | success              |

### 28.7 Role APIs

| Method | Path                          | Description               | Main Request             | Main Response   |
| ------ | ----------------------------- | ------------------------- | ------------------------ | --------------- |
| GET    | `/api/roles`                  | Query roles               | filters, pagination      | paged role list |
| POST   | `/api/roles`                  | Create role               | role fields              | created role    |
| GET    | `/api/roles/{id}`             | Get role detail           | path id                  | role detail     |
| PATCH  | `/api/roles/{id}`             | Update role               | changed fields           | updated role    |
| DELETE | `/api/roles/{id}`             | Delete role where allowed | path id                  | success         |
| POST   | `/api/roles/{id}/copy`        | Copy role and permissions | new role name/code       | created role    |
| GET    | `/api/roles/{id}/permissions` | Get role permissions      | path id                  | permissions     |
| PUT    | `/api/roles/{id}/permissions` | Update role permissions   | permission configuration | success         |
| POST   | `/api/roles/{id}/enable`      | Enable role               | path id                  | success         |
| POST   | `/api/roles/{id}/disable`     | Disable role              | path id                  | success         |

### 28.8 Permission APIs

| Method | Path                                       | Description                                        | Main Request     | Main Response         |
| ------ | ------------------------------------------ | -------------------------------------------------- | ---------------- | --------------------- |
| GET    | `/api/permissions/tree`                    | Get permission tree                                | optional filters | permission tree       |
| GET    | `/api/permissions/effective`               | Get effective permissions for current user/context | none             | effective permissions |
| POST   | `/api/permissions/api/sync`                | Scan and sync backend API identifiers              | none             | sync result           |
| GET    | `/api/permissions/api`                     | Query API permission identifiers                   | filters          | API identifiers       |
| PUT    | `/api/permissions/user-overrides/{userId}` | Update user permission overrides                   | permissions      | success               |
| GET    | `/api/permissions/data-rules`              | Query data permission rules                        | filters          | rule list             |
| POST   | `/api/permissions/data-rules`              | Create data permission rule                        | rule definition  | created rule          |
| PATCH  | `/api/permissions/data-rules/{id}`         | Update data permission rule                        | changed fields   | updated rule          |
| DELETE | `/api/permissions/data-rules/{id}`         | Delete data permission rule                        | path id          | success               |
| GET    | `/api/permissions/field-rules`             | Query field permission rules                       | filters          | rule list             |
| PUT    | `/api/permissions/field-rules`             | Update field permission rules                      | rules            | success               |

### 28.9 Menu APIs

| Method | Path                            | Description                         | Main Request     | Main Response  |
| ------ | ------------------------------- | ----------------------------------- | ---------------- | -------------- |
| GET    | `/api/menus/tree`               | Query menu tree                     | filters          | menu tree      |
| POST   | `/api/menus`                    | Create menu                         | menu fields      | created menu   |
| PATCH  | `/api/menus/{id}`               | Update menu                         | changed fields   | updated menu   |
| DELETE | `/api/menus/{id}`               | Delete menu                         | path id          | success        |
| POST   | `/api/menus/{id}/actions`       | Create action permission under menu | action fields    | created action |
| PATCH  | `/api/menus/actions/{actionId}` | Update action permission            | changed fields   | updated action |
| DELETE | `/api/menus/actions/{actionId}` | Delete action permission            | path id          | success        |
| PUT    | `/api/menus/{id}/api-bindings`  | Bind API identifiers                | apiPermissionIds | success        |
| PATCH  | `/api/menus/sort`               | Update menu sort order              | sort payload     | success        |

### 28.10 System Configuration APIs

| Method | Path                         | Description         | Main Request | Main Response  |
| ------ | ---------------------------- | ------------------- | ------------ | -------------- |
| GET    | `/api/system-configs`        | Query configuration | filters      | config list    |
| GET    | `/api/system-configs/{key}`  | Get config by key   | path key     | config detail  |
| PATCH  | `/api/system-configs/{key}`  | Update config       | value        | updated config |
| GET    | `/api/system-configs/groups` | Query config groups | none         | groups         |

### 28.11 Dictionary APIs

| Method | Path                                 | Description            | Main Request   | Main Response |
| ------ | ------------------------------------ | ---------------------- | -------------- | ------------- |
| GET    | `/api/dictionaries/types`            | Query dictionary types | filters        | type list     |
| POST   | `/api/dictionaries/types`            | Create dictionary type | type fields    | created type  |
| PATCH  | `/api/dictionaries/types/{id}`       | Update dictionary type | changed fields | updated type  |
| DELETE | `/api/dictionaries/types/{id}`       | Delete dictionary type | path id        | success       |
| GET    | `/api/dictionaries/types/{id}/items` | Query dictionary items | filters        | item list     |
| POST   | `/api/dictionaries/items`            | Create dictionary item | item fields    | created item  |
| PATCH  | `/api/dictionaries/items/{id}`       | Update dictionary item | changed fields | updated item  |
| DELETE | `/api/dictionaries/items/{id}`       | Delete dictionary item | path id        | success       |

### 28.12 File APIs

| Method | Path                         | Description                             | Main Request        | Main Response         |
| ------ | ---------------------------- | --------------------------------------- | ------------------- | --------------------- |
| GET    | `/api/files`                 | Query files                             | filters, pagination | paged file list       |
| POST   | `/api/files/upload`          | Upload file                             | multipart file      | file metadata         |
| GET    | `/api/files/{id}`            | Get file metadata                       | path id             | file metadata         |
| GET    | `/api/files/{id}/download`   | Download file with permission check     | path id             | file stream           |
| GET    | `/api/files/{id}/preview`    | Preview image                           | path id             | preview stream or URL |
| DELETE | `/api/files/{id}`            | Delete file and mark references invalid | path id             | success               |
| GET    | `/api/files/{id}/references` | Query file references                   | path id             | reference list        |

### 28.13 Notification APIs

| Method | Path                               | Description                        | Main Request        | Main Response        |
| ------ | ---------------------------------- | ---------------------------------- | ------------------- | -------------------- |
| GET    | `/api/announcements`               | Query announcements                | filters             | announcement list    |
| POST   | `/api/announcements`               | Create announcement                | announcement fields | created announcement |
| PATCH  | `/api/announcements/{id}`          | Update announcement                | changed fields      | updated announcement |
| POST   | `/api/announcements/{id}/publish`  | Publish announcement               | publish scope       | success              |
| DELETE | `/api/announcements/{id}`          | Delete announcement                | path id             | success              |
| GET    | `/api/notifications`               | Query current user's notifications | filters             | notification list    |
| POST   | `/api/notifications/{id}/read`     | Mark as read                       | path id             | success              |
| POST   | `/api/notifications/{id}/archive`  | Archive notification               | path id             | success              |
| DELETE | `/api/notifications/{id}`          | Delete notification                | path id             | success              |
| GET    | `/api/notification-templates`      | Query templates                    | filters             | template list        |
| POST   | `/api/notification-templates`      | Create template                    | template fields     | created template     |
| PATCH  | `/api/notification-templates/{id}` | Update template                    | changed fields      | updated template     |
| DELETE | `/api/notification-templates/{id}` | Delete template                    | path id             | success              |
| GET    | `/api/webhooks`                    | Query webhooks                     | filters             | webhook list         |
| POST   | `/api/webhooks`                    | Create webhook subscription        | webhook fields      | created webhook      |
| PATCH  | `/api/webhooks/{id}`               | Update webhook subscription        | changed fields      | updated webhook      |
| DELETE | `/api/webhooks/{id}`               | Delete webhook subscription        | path id             | success              |

### 28.14 Log APIs

| Method | Path                                    | Description                 | Main Request        | Main Response |
| ------ | --------------------------------------- | --------------------------- | ------------------- | ------------- |
| GET    | `/api/logs/login`                       | Query login logs            | filters, pagination | paged logs    |
| GET    | `/api/logs/operations`                  | Query operation logs        | filters, pagination | paged logs    |
| GET    | `/api/logs/access`                      | Query access logs           | filters, pagination | paged logs    |
| GET    | `/api/logs/api`                         | Query API logs              | filters, pagination | paged logs    |
| GET    | `/api/logs/exceptions`                  | Query exception logs        | filters, pagination | paged logs    |
| GET    | `/api/logs/security`                    | Query security logs         | filters, pagination | paged logs    |
| GET    | `/api/logs/files`                       | Query file operation logs   | filters, pagination | paged logs    |
| POST   | `/api/logs/export`                      | Create async CSV log export | log type, filters   | export task   |
| GET    | `/api/logs/retention-configs`           | Get retention configs       | none                | configs       |
| PATCH  | `/api/logs/retention-configs/{logType}` | Update retention config     | retention days      | success       |

### 28.15 Scheduled Task APIs

| Method | Path                        | Description              | Main Request        | Main Response    |
| ------ | --------------------------- | ------------------------ | ------------------- | ---------------- |
| GET    | `/api/jobs`                 | Query jobs               | filters, pagination | job list         |
| POST   | `/api/jobs`                 | Create job               | job fields          | created job      |
| PATCH  | `/api/jobs/{id}`            | Update job               | changed fields      | updated job      |
| POST   | `/api/jobs/{id}/enable`     | Enable job               | path id             | success          |
| POST   | `/api/jobs/{id}/disable`    | Disable job              | path id             | success          |
| POST   | `/api/jobs/{id}/run`        | Run job manually         | parameters          | execution record |
| GET    | `/api/jobs/{id}/executions` | Query job execution logs | filters             | execution logs   |

### 28.16 Import/Export APIs

| Method | Path                                          | Description                       | Main Request           | Main Response |
| ------ | --------------------------------------------- | --------------------------------- | ---------------------- | ------------- |
| GET    | `/api/import-export/tasks`                    | Query import/export tasks         | filters, pagination    | task list     |
| GET    | `/api/import-export/tasks/{id}`               | Get task detail                   | path id                | task detail   |
| GET    | `/api/import-export/tasks/{id}/download`      | Download successful export result | path id                | file          |
| GET    | `/api/import-export/tasks/{id}/errors`        | Download import error report      | path id                | file          |
| POST   | `/api/import-export/import`                   | Create import task                | resource type, file id | import task   |
| POST   | `/api/import-export/export`                   | Create export task                | resource type, filters | export task   |
| GET    | `/api/import-export/templates/{resourceType}` | Download import template          | resource type          | file          |

### 28.17 Personal Center APIs

| Method | Path                       | Description          | Main Request          | Main Response   |
| ------ | -------------------------- | -------------------- | --------------------- | --------------- |
| GET    | `/api/profile`             | Get own profile      | none                  | profile         |
| PATCH  | `/api/profile`             | Update own profile   | allowed fields        | updated profile |
| PATCH  | `/api/profile/preferences` | Update preferences   | language, theme, tabs | preferences     |
| POST   | `/api/profile/avatar`      | Upload/change avatar | file id               | updated profile |

### 28.18 Initialization APIs

| Method | Path                    | Description                      | Main Request                   | Main Response    |
| ------ | ----------------------- | -------------------------------- | ------------------------------ | ---------------- |
| GET    | `/api/setup/status`     | Check initialization status      | none                           | initialized flag |
| POST   | `/api/setup/initialize` | Run first startup initialization | root org, admin, base settings | success          |

### 28.19 Observability APIs

| Method | Path           | Description                | Main Request | Main Response                |
| ------ | -------------- | -------------------------- | ------------ | ---------------------------- |
| GET    | `/api/health`  | Health check               | none         | health status                |
| GET    | `/api/metrics` | Metrics endpoint, reserved | none         | metrics or reserved response |

---

## 29. Data Model Draft

The data model below is database-neutral and should be implementable on PostgreSQL and SQL Server. Field names are draft-level and may be adjusted during technical design. Core tables should reserve `tenant_id` for future multi-tenant expansion, while tenant management is not implemented in Version 1.

### 29.1 Common Columns

Where applicable, entities should include:

| Field        | Description                                             |
| ------------ | ------------------------------------------------------- |
| `id`         | Primary identifier                                      |
| `tenant_id`  | Reserved for future tenant support                      |
| `created_at` | Creation timestamp                                      |
| `updated_at` | Update timestamp                                        |
| `deleted_at` | Logical deletion timestamp, if logical deletion applies |
| `status`     | Enabled, disabled, locked, or module-specific status    |

### 29.2 Organization

| Entity          | Field           | Description                |
| --------------- | --------------- | -------------------------- |
| `organizations` | `id`            | Primary key                |
| `organizations` | `tenant_id`     | Reserved tenant identifier |
| `organizations` | `parent_id`     | Parent organization id     |
| `organizations` | `name`          | Organization name          |
| `organizations` | `code`          | Organization code          |
| `organizations` | `owner_user_id` | Responsible user           |
| `organizations` | `phone`         | Contact phone              |
| `organizations` | `email`         | Contact email              |
| `organizations` | `address`       | Address                    |
| `organizations` | `sort_order`    | Display order              |
| `organizations` | `status`        | Enabled or disabled        |
| `organizations` | `remark`        | Remarks                    |
| `organizations` | `created_at`    | Created time               |
| `organizations` | `updated_at`    | Updated time               |
| `organizations` | `deleted_at`    | Logical deletion time      |

Constraints:

1. Organization code must be unique within the applicable scope.
2. Parent-child relationships must not create cycles.
3. Maximum depth must respect system configuration.

### 29.3 User

| Entity  | Field                   | Description                       |
| ------- | ----------------------- | --------------------------------- |
| `users` | `id`                    | Primary key                       |
| `users` | `tenant_id`             | Reserved tenant identifier        |
| `users` | `username`              | Login username                    |
| `users` | `display_name`          | Name or nickname                  |
| `users` | `email`                 | Unique email                      |
| `users` | `phone`                 | Unique phone number               |
| `users` | `avatar_file_id`        | Avatar file id                    |
| `users` | `gender`                | Gender                            |
| `users` | `employee_no`           | Employee number                   |
| `users` | `primary_org_id`        | Primary organization id           |
| `users` | `status`                | Enabled, disabled, locked         |
| `users` | `password_hash`         | Password hash                     |
| `users` | `password_changed_at`   | Password update time              |
| `users` | `force_password_change` | Whether forced to change password |
| `users` | `lock_until`            | Lock expiration time              |
| `users` | `remark`                | Remarks                           |
| `users` | `last_login_at`         | Last login time                   |
| `users` | `created_by`            | Creator user id                   |
| `users` | `updated_by`            | Updater user id                   |
| `users` | `created_at`            | Created time                      |
| `users` | `updated_at`            | Updated time                      |
| `users` | `deleted_at`            | Logical deletion time             |

Constraints:

1. Email must be unique.
2. Phone must be unique.
3. Logically deleted users cannot log in.

### 29.4 User Organization Role Binding

| Entity                    | Field             | Description                                             |
| ------------------------- | ----------------- | ------------------------------------------------------- |
| `user_organization_roles` | `id`              | Primary key                                             |
| `user_organization_roles` | `tenant_id`       | Reserved tenant identifier                              |
| `user_organization_roles` | `user_id`         | User id                                                 |
| `user_organization_roles` | `organization_id` | Organization id                                         |
| `user_organization_roles` | `role_id`         | Role id                                                 |
| `user_organization_roles` | `is_primary`      | Whether this is the user's primary organization binding |
| `user_organization_roles` | `status`          | Enabled or disabled                                     |
| `user_organization_roles` | `created_at`      | Created time                                            |
| `user_organization_roles` | `updated_at`      | Updated time                                            |

Constraints:

1. A user can have only one binding per organization.
2. A user can have only one primary organization.
3. A user has one role per organization.

### 29.5 Role

| Entity  | Field         | Description                |
| ------- | ------------- | -------------------------- |
| `roles` | `id`          | Primary key                |
| `roles` | `tenant_id`   | Reserved tenant identifier |
| `roles` | `name`        | Role name                  |
| `roles` | `code`        | Role code                  |
| `roles` | `status`      | Enabled or disabled        |
| `roles` | `description` | Description                |
| `roles` | `created_at`  | Created time               |
| `roles` | `updated_at`  | Updated time               |
| `roles` | `deleted_at`  | Logical deletion time      |

### 29.6 Permission Resources

| Entity                 | Field           | Description                          |
| ---------------------- | --------------- | ------------------------------------ |
| `permission_resources` | `id`            | Primary key                          |
| `permission_resources` | `tenant_id`     | Reserved tenant identifier           |
| `permission_resources` | `resource_type` | Menu, page, action, API, data, field |
| `permission_resources` | `code`          | Permission code                      |
| `permission_resources` | `name`          | Permission name                      |
| `permission_resources` | `parent_id`     | Parent permission id                 |
| `permission_resources` | `status`        | Enabled or disabled                  |
| `permission_resources` | `metadata`      | Resource-specific metadata           |
| `permission_resources` | `created_at`    | Created time                         |
| `permission_resources` | `updated_at`    | Updated time                         |

### 29.7 Role Permissions

| Entity             | Field                    | Description                                   |
| ------------------ | ------------------------ | --------------------------------------------- |
| `role_permissions` | `id`                     | Primary key                                   |
| `role_permissions` | `tenant_id`              | Reserved tenant identifier                    |
| `role_permissions` | `role_id`                | Role id                                       |
| `role_permissions` | `permission_resource_id` | Permission resource id                        |
| `role_permissions` | `effect`                 | Allow or deny, if supported by implementation |
| `role_permissions` | `created_at`             | Created time                                  |

### 29.8 User Permission Overrides

| Entity                      | Field                    | Description                |
| --------------------------- | ------------------------ | -------------------------- |
| `user_permission_overrides` | `id`                     | Primary key                |
| `user_permission_overrides` | `tenant_id`              | Reserved tenant identifier |
| `user_permission_overrides` | `user_id`                | User id                    |
| `user_permission_overrides` | `organization_id`        | Organization context id    |
| `user_permission_overrides` | `permission_resource_id` | Permission resource id     |
| `user_permission_overrides` | `effect`                 | Allow or deny              |
| `user_permission_overrides` | `created_at`             | Created time               |

### 29.9 Organization Permission Policies

| Entity                             | Field                    | Description                |
| ---------------------------------- | ------------------------ | -------------------------- |
| `organization_permission_policies` | `id`                     | Primary key                |
| `organization_permission_policies` | `tenant_id`              | Reserved tenant identifier |
| `organization_permission_policies` | `organization_id`        | Organization id            |
| `organization_permission_policies` | `permission_resource_id` | Permission resource id     |
| `organization_permission_policies` | `effect`                 | Allow or deny              |
| `organization_permission_policies` | `created_at`             | Created time               |

### 29.10 Menu

| Entity  | Field             | Description                |
| ------- | ----------------- | -------------------------- |
| `menus` | `id`              | Primary key                |
| `menus` | `tenant_id`       | Reserved tenant identifier |
| `menus` | `parent_id`       | Parent menu id             |
| `menus` | `name`            | Menu name                  |
| `menus` | `i18n_key`        | i18n key                   |
| `menus` | `icon`            | Icon key                   |
| `menus` | `route_path`      | Frontend route path        |
| `menus` | `component_key`   | Frontend component key     |
| `menus` | `permission_code` | Menu/page permission code  |
| `menus` | `visible`         | Whether shown in menu      |
| `menus` | `sort_order`      | Sort order                 |
| `menus` | `status`          | Enabled or disabled        |
| `menus` | `created_at`      | Created time               |
| `menus` | `updated_at`      | Updated time               |

### 29.11 API Permission

| Entity            | Field         | Description                            |
| ----------------- | ------------- | -------------------------------------- |
| `api_permissions` | `id`          | Primary key                            |
| `api_permissions` | `tenant_id`   | Reserved tenant identifier             |
| `api_permissions` | `method`      | HTTP method                            |
| `api_permissions` | `path`        | API path pattern                       |
| `api_permissions` | `code`        | API permission code                    |
| `api_permissions` | `description` | Description                            |
| `api_permissions` | `log_level`   | None, basic, request, request_response |
| `api_permissions` | `status`      | Enabled or disabled                    |
| `api_permissions` | `created_at`  | Created time                           |
| `api_permissions` | `updated_at`  | Updated time                           |

### 29.12 Menu API Bindings

| Entity              | Field               | Description                |
| ------------------- | ------------------- | -------------------------- |
| `menu_api_bindings` | `id`                | Primary key                |
| `menu_api_bindings` | `tenant_id`         | Reserved tenant identifier |
| `menu_api_bindings` | `menu_id`           | Menu or action id          |
| `menu_api_bindings` | `api_permission_id` | API permission id          |
| `menu_api_bindings` | `created_at`        | Created time               |

### 29.13 Data Permission Rules

| Entity                  | Field           | Description                                                                                                   |
| ----------------------- | --------------- | ------------------------------------------------------------------------------------------------------------- |
| `data_permission_rules` | `id`            | Primary key                                                                                                   |
| `data_permission_rules` | `tenant_id`     | Reserved tenant identifier                                                                                    |
| `data_permission_rules` | `resource_type` | Resource type                                                                                                 |
| `data_permission_rules` | `name`          | Rule name                                                                                                     |
| `data_permission_rules` | `scope_type`    | Own, current_org, org_with_children, specified_orgs, all, custom_user, custom_role, resource_type, expression |
| `data_permission_rules` | `rule_config`   | Visual rule configuration                                                                                     |
| `data_permission_rules` | `status`        | Enabled or disabled                                                                                           |
| `data_permission_rules` | `created_at`    | Created time                                                                                                  |
| `data_permission_rules` | `updated_at`    | Updated time                                                                                                  |

### 29.14 Field Permission Rules

| Entity                   | Field           | Description                                      |
| ------------------------ | --------------- | ------------------------------------------------ |
| `field_permission_rules` | `id`            | Primary key                                      |
| `field_permission_rules` | `tenant_id`     | Reserved tenant identifier                       |
| `field_permission_rules` | `resource_type` | Resource type                                    |
| `field_permission_rules` | `field_key`     | Field key                                        |
| `field_permission_rules` | `field_name`    | Field display name                               |
| `field_permission_rules` | `scenario`      | List, detail, create, edit, export, api_response |
| `field_permission_rules` | `visible`       | Whether field is visible                         |
| `field_permission_rules` | `editable`      | Whether field is editable                        |
| `field_permission_rules` | `target_type`   | User, role, organization, default                |
| `field_permission_rules` | `target_id`     | Target id                                        |
| `field_permission_rules` | `created_at`    | Created time                                     |
| `field_permission_rules` | `updated_at`    | Updated time                                     |

### 29.15 Authentication Sessions

| Entity          | Field                     | Description                |
| --------------- | ------------------------- | -------------------------- |
| `auth_sessions` | `id`                      | Primary key                |
| `auth_sessions` | `tenant_id`               | Reserved tenant identifier |
| `auth_sessions` | `user_id`                 | User id                    |
| `auth_sessions` | `refresh_token_hash`      | Refresh token hash         |
| `auth_sessions` | `current_organization_id` | Current organization id    |
| `auth_sessions` | `ip_address`              | IP address                 |
| `auth_sessions` | `user_agent`              | User agent                 |
| `auth_sessions` | `expires_at`              | Expiration time            |
| `auth_sessions` | `revoked_at`              | Revocation time            |
| `auth_sessions` | `created_at`              | Created time               |
| `auth_sessions` | `last_seen_at`            | Last seen time             |

### 29.16 System Configuration

| Entity           | Field          | Description                   |
| ---------------- | -------------- | ----------------------------- |
| `system_configs` | `id`           | Primary key                   |
| `system_configs` | `tenant_id`    | Reserved tenant identifier    |
| `system_configs` | `config_key`   | Unique key                    |
| `system_configs` | `config_value` | Value                         |
| `system_configs` | `value_type`   | String, number, boolean, JSON |
| `system_configs` | `group_key`    | Configuration group           |
| `system_configs` | `description`  | Description                   |
| `system_configs` | `editable`     | Whether editable              |
| `system_configs` | `status`       | Enabled or disabled           |
| `system_configs` | `updated_at`   | Updated time                  |

### 29.17 Dictionaries

| Entity             | Field            | Description                |
| ------------------ | ---------------- | -------------------------- |
| `dictionary_types` | `id`             | Primary key                |
| `dictionary_types` | `tenant_id`      | Reserved tenant identifier |
| `dictionary_types` | `code`           | Dictionary type code       |
| `dictionary_types` | `name`           | Type name                  |
| `dictionary_types` | `description`    | Description                |
| `dictionary_types` | `status`         | Enabled or disabled        |
| `dictionary_items` | `id`             | Primary key                |
| `dictionary_items` | `tenant_id`      | Reserved tenant identifier |
| `dictionary_items` | `type_id`        | Dictionary type id         |
| `dictionary_items` | `item_value`     | Stored value               |
| `dictionary_items` | `label_i18n_key` | i18n key for label         |
| `dictionary_items` | `sort_order`     | Sort order                 |
| `dictionary_items` | `status`         | Enabled or disabled        |

### 29.18 Files

| Entity            | Field           | Description                    |
| ----------------- | --------------- | ------------------------------ |
| `files`           | `id`            | Primary key                    |
| `files`           | `tenant_id`     | Reserved tenant identifier     |
| `files`           | `storage_type`  | Local or S3-compatible         |
| `files`           | `bucket`        | Bucket/container if applicable |
| `files`           | `object_key`    | Storage object key/path        |
| `files`           | `original_name` | Original filename              |
| `files`           | `extension`     | File extension                 |
| `files`           | `mime_type`     | MIME type                      |
| `files`           | `size_bytes`    | File size                      |
| `files`           | `checksum`      | File checksum if available     |
| `files`           | `status`        | Available, deleted, invalid    |
| `files`           | `uploaded_by`   | Uploader user id               |
| `files`           | `created_at`    | Uploaded time                  |
| `file_references` | `id`            | Primary key                    |
| `file_references` | `tenant_id`     | Reserved tenant identifier     |
| `file_references` | `file_id`       | File id                        |
| `file_references` | `resource_type` | Referencing resource type      |
| `file_references` | `resource_id`   | Referencing resource id        |
| `file_references` | `status`        | Active or invalid              |
| `file_references` | `created_at`    | Created time                   |

### 29.19 Notifications and Webhooks

| Entity                   | Field               | Description                     |
| ------------------------ | ------------------- | ------------------------------- |
| `announcements`          | `id`                | Primary key                     |
| `announcements`          | `tenant_id`         | Reserved tenant identifier      |
| `announcements`          | `title`             | Title                           |
| `announcements`          | `content`           | Content                         |
| `announcements`          | `scope_type`        | System or organization          |
| `announcements`          | `status`            | Draft, published, deleted       |
| `announcements`          | `published_at`      | Publish time                    |
| `notifications`          | `id`                | Primary key                     |
| `notifications`          | `tenant_id`         | Reserved tenant identifier      |
| `notifications`          | `recipient_user_id` | Recipient user id               |
| `notifications`          | `title`             | Title                           |
| `notifications`          | `content`           | Content                         |
| `notifications`          | `status`            | Unread, read, archived, deleted |
| `notifications`          | `created_at`        | Created time                    |
| `notification_templates` | `id`                | Primary key                     |
| `notification_templates` | `tenant_id`         | Reserved tenant identifier      |
| `notification_templates` | `channel`           | In-app, email, SMS              |
| `notification_templates` | `template_code`     | Template code                   |
| `notification_templates` | `language`          | Language                        |
| `notification_templates` | `subject`           | Subject/title                   |
| `notification_templates` | `body`              | Template body                   |
| `notification_templates` | `variables`         | Supported variables             |
| `webhook_subscriptions`  | `id`                | Primary key                     |
| `webhook_subscriptions`  | `tenant_id`         | Reserved tenant identifier      |
| `webhook_subscriptions`  | `name`              | Webhook name                    |
| `webhook_subscriptions`  | `url`               | Target URL                      |
| `webhook_subscriptions`  | `event_types`       | Subscribed events               |
| `webhook_subscriptions`  | `secret`            | Signing secret if used          |
| `webhook_subscriptions`  | `status`            | Enabled or disabled             |

### 29.20 Scheduled Jobs

| Entity               | Field             | Description                |
| -------------------- | ----------------- | -------------------------- |
| `scheduled_jobs`     | `id`              | Primary key                |
| `scheduled_jobs`     | `tenant_id`       | Reserved tenant identifier |
| `scheduled_jobs`     | `name`            | Job name                   |
| `scheduled_jobs`     | `code`            | Job code                   |
| `scheduled_jobs`     | `cron_expression` | Cron expression            |
| `scheduled_jobs`     | `parameters`      | Job parameters             |
| `scheduled_jobs`     | `retry_policy`    | Retry configuration        |
| `scheduled_jobs`     | `timeout_seconds` | Timeout configuration      |
| `scheduled_jobs`     | `lock_key`        | Distributed lock key       |
| `scheduled_jobs`     | `status`          | Enabled or disabled        |
| `scheduled_jobs`     | `created_at`      | Created time               |
| `job_execution_logs` | `id`              | Primary key                |
| `job_execution_logs` | `tenant_id`       | Reserved tenant identifier |
| `job_execution_logs` | `job_id`          | Job id                     |
| `job_execution_logs` | `started_at`      | Start time                 |
| `job_execution_logs` | `finished_at`     | Finish time                |
| `job_execution_logs` | `status`          | Success, failed, timeout   |
| `job_execution_logs` | `message`         | Result message             |

### 29.21 Import/Export Tasks

| Entity                | Field            | Description                       |
| --------------------- | ---------------- | --------------------------------- |
| `import_export_tasks` | `id`             | Primary key                       |
| `import_export_tasks` | `tenant_id`      | Reserved tenant identifier        |
| `import_export_tasks` | `task_type`      | Import or export                  |
| `import_export_tasks` | `resource_type`  | Target resource type              |
| `import_export_tasks` | `status`         | Pending, running, success, failed |
| `import_export_tasks` | `source_file_id` | Uploaded source file for import   |
| `import_export_tasks` | `result_file_id` | Generated export file             |
| `import_export_tasks` | `error_file_id`  | Error report file                 |
| `import_export_tasks` | `created_by`     | Creator user id                   |
| `import_export_tasks` | `created_at`     | Created time                      |
| `import_export_tasks` | `finished_at`    | Finish time                       |

### 29.22 Logs

The implementation may use separate tables or a partitioned unified log table. At the logical data model level, logs must contain these common fields:

| Field             | Description                                                   |
| ----------------- | ------------------------------------------------------------- |
| `id`              | Primary key                                                   |
| `tenant_id`       | Reserved tenant identifier                                    |
| `log_type`        | Login, operation, access, API, exception, security, job, file |
| `user_id`         | Acting user                                                   |
| `organization_id` | Current organization context                                  |
| `ip_address`      | Client IP                                                     |
| `user_agent`      | User agent                                                    |
| `request_id`      | Request ID / Trace ID                                         |
| `resource_type`   | Target resource type                                          |
| `resource_id`     | Target resource id                                            |
| `action`          | Operation/action name                                         |
| `status`          | Success, failed, denied, etc.                                 |
| `message`         | Summary message                                               |
| `metadata`        | Structured metadata with sensitive fields masked              |
| `created_at`      | Log time                                                      |

### 29.23 Internationalization

| Entity          | Field           | Description                |
| --------------- | --------------- | -------------------------- |
| `i18n_messages` | `id`            | Primary key                |
| `i18n_messages` | `tenant_id`     | Reserved tenant identifier |
| `i18n_messages` | `message_key`   | Translation key            |
| `i18n_messages` | `language`      | Language code              |
| `i18n_messages` | `message_value` | Translated value           |
| `i18n_messages` | `module`        | Owning module              |
| `i18n_messages` | `updated_at`    | Updated time               |

### 29.24 User Preferences

| Entity             | Field               | Description                   |
| ------------------ | ------------------- | ----------------------------- |
| `user_preferences` | `id`                | Primary key                   |
| `user_preferences` | `tenant_id`         | Reserved tenant identifier    |
| `user_preferences` | `user_id`           | User id                       |
| `user_preferences` | `language`          | User language preference      |
| `user_preferences` | `theme_mode`        | Light or dark                 |
| `user_preferences` | `theme_color`       | Theme color                   |
| `user_preferences` | `page_tabs_enabled` | Whether page tabs are enabled |
| `user_preferences` | `updated_at`        | Updated time                  |

---

## 30. Unified Error Code Specification

### 30.1 Error Code Categories

The system must define error code categories for:

1. Authentication
2. Authorization and permissions
3. Validation and parameters
4. Business rules
5. System errors
6. Third-party integration errors

### 30.2 Error Code Format

Recommended format:

```text
<CATEGORY>_<SPECIFIC_REASON>
```

Examples:

| Code                              | Category       | Description                     |
| --------------------------------- | -------------- | ------------------------------- |
| `AUTH_INVALID_CREDENTIALS`        | Authentication | Username or password is invalid |
| `AUTH_TOKEN_EXPIRED`              | Authentication | Access token expired            |
| `AUTH_ACCOUNT_LOCKED`             | Authentication | Account is locked               |
| `PERMISSION_DENIED`               | Authorization  | User lacks required permission  |
| `PERMISSION_API_DENIED`           | Authorization  | User lacks API permission       |
| `VALIDATION_REQUIRED_FIELD`       | Validation     | Required field missing          |
| `VALIDATION_DUPLICATE_EMAIL`      | Validation     | Email already exists            |
| `BUSINESS_ORG_DISABLED`           | Business       | Organization is disabled        |
| `BUSINESS_MAX_ORG_DEPTH_EXCEEDED` | Business       | Organization max depth exceeded |
| `SYSTEM_INTERNAL_ERROR`           | System         | Unexpected internal error       |
| `THIRD_PARTY_WEBHOOK_FAILED`      | Third-party    | Webhook delivery failed         |

### 30.3 Acceptance Criteria

1. Given an error occurs, when the API responds, then the response includes a stable error code.
2. Given the user's language is English or Chinese, when an error message is returned, then the message follows the user's language where translation exists.
3. Given a permission error occurs, when the frontend receives it, then the frontend can display a meaningful error and avoid exposing unauthorized data.

---

## 31. Security Requirements

1. Passwords must never be stored in plain text.
2. Sensitive fields must be masked in logs.
3. API authorization must be enforced on the backend, not only in the frontend.
4. Field-level permissions must be enforced in backend responses where applicable.
5. Deleted files referenced by data must be displayed as invalid or unavailable.
6. Disabled organizations cannot be used as current organization context.
7. Disabled, locked, and logically deleted users cannot log in.
8. Refresh tokens should be stored in a way that allows invalidation.
9. All security-sensitive events must generate security logs.

---

## 32. Non-Functional Requirements

### 32.1 Compatibility

The system must support at least:

1. PostgreSQL
2. SQL Server

### 32.2 Performance

No numeric performance targets are defined in the confirmed requirements. The following product-level requirements apply:

1. List pages must support pagination.
2. Large import/export tasks must run asynchronously.
3. All log exports must run asynchronously.
4. Scheduled jobs must support distributed locking.

### 32.3 Reliability

1. Scheduled tasks must record execution logs.
2. Failed scheduled tasks must support retry configuration.
3. Webhook deliveries should be trackable by delivery status and logs.
4. Import/export tasks must expose task status and error reports.

### 32.4 Maintainability

1. Future modules must follow the business module extension specification.
2. Permission identifiers should be stable and human-readable.
3. Error codes should be stable and documented.
4. i18n keys should be stable and module-scoped.

---

## 33. Acceptance Checklist

The first version is acceptable only when all of the following are true:

1. A fresh deployment can be initialized through startup wizard and seed script.
2. A super administrator can log in.
3. The super administrator can create, edit, disable, and manage organizations.
4. Multiple root organizations are supported, with one default root organization initialized.
5. Disabling a parent organization disables all child organizations.
6. Users can belong to multiple organizations.
7. A user has one role per organization.
8. The system defaults to the user's primary organization after login.
9. Switching organization refreshes permissions.
10. Menu, page, action, API, data, and field-level permissions are supported.
11. API permission identifiers can be scanned from backend APIs and bound by administrators.
12. Role copy copies permission configuration.
13. Email and phone uniqueness are enforced.
14. Username can be modified by administrators.
15. User deletion is logical deletion.
16. Password policy supports default minimum 8 characters with letters and numbers.
17. Password expiration cycle defaults to 365 days.
18. Login failure lock settings are configurable.
19. Administrator password reset is supported.
20. Online users can be viewed.
21. System configuration is global in Version 1.
22. Dictionaries are global in Version 1 and support i18n labels.
23. File upload supports local and S3-compatible storage.
24. File upload defaults to 50 MB per file.
25. File whitelist includes images, documents, and zip archives.
26. Referenced deleted files are displayed as invalid or unavailable.
27. Announcements support system-wide and organization-based publishing.
28. In-app notifications support unread, read, archived, and deleted states.
29. SMTP email notifications are supported.
30. Webhooks support notification sending and event subscription.
31. SMS templates and channel abstraction are reserved but no SMS sending is implemented.
32. All required log types are available.
33. Log retention defaults to 90 days per type and can be adjusted separately.
34. All log exports are asynchronous CSV tasks.
35. API log level is configurable per interface and sensitive fields are masked.
36. Scheduled tasks support Cron, enable/disable, manual run, retry, timeout, distributed lock, parameters, and execution logs.
37. Import/export framework supports CSV, template download, validation, error report, and async tasks.
38. i18n covers frontend UI, backend errors, notification templates, and dictionary data.
39. User language preference overrides administrator default language.
40. Desktop admin layout supports left menu, top bar, breadcrumbs, tabs, fullscreen, dark mode, and theme color.
41. Page tabs can be disabled in personal settings.
42. Health check, metrics reservation, Request ID / Trace ID, structured logs, and alert interface reservation are included.
43. The API design uses `/api` in Version 1 and allows future `/api/v2` expansion.
44. Unified error code categories and examples are documented.
45. Future business modules can integrate with base permissions, data permissions, field permissions, logs, files, import/export, notifications, and i18n.

---

## 34. Appendix: Confirmed Decisions

| Topic                        | Confirmed Decision                                                                     |
| ---------------------------- | -------------------------------------------------------------------------------------- |
| System type                  | Multi-organization web admin base                                                      |
| Branch terminology           | Organization                                                                           |
| Organization hierarchy       | Tree structure                                                                         |
| Multiple root organizations  | Allowed; initialize one default root                                                   |
| Organization max depth       | Configurable                                                                           |
| User organization membership | Multiple organizations per user                                                        |
| Role per organization        | One role per user per organization                                                     |
| Data isolation               | Partially isolated by organization, with global/shared data support for future modules |
| Tenant                       | No tenant management in v1; reserve `tenant_id`                                        |
| Built-in roles               | Super administrator, organization administrator, normal user                           |
| Super administrator          | Not restricted by organization                                                         |
| Permission model             | RBAC + custom data permission rules                                                    |
| Permission dimensions        | Menu, page, action, API, data, field                                                   |
| Permission conflict order    | User > role > organization > system default                                            |
| Login                        | Username + password                                                                    |
| Auth token                   | JWT Access Token + Refresh Token                                                       |
| Token expiration             | Configurable                                                                           |
| MFA                          | Reserved only                                                                          |
| SSO                          | Reserved only                                                                          |
| Password complexity default  | Minimum 8 characters with letters and numbers                                          |
| Password expiration default  | 365 days                                                                               |
| Login failure lock           | Configurable attempts and duration                                                     |
| Password recovery            | Administrator reset only                                                               |
| Online users                 | View only in v1                                                                        |
| Logs                         | Login, operation, access, API, exception, security, job, file                          |
| Log retention                | Default 90 days per type, adjustable separately                                        |
| Log export                   | Asynchronous CSV                                                                       |
| API log                      | Configurable per interface; sensitive fields always masked                             |
| Notification channels        | Announcement, in-app, SMTP email, webhook; SMS reserved                                |
| Webhook                      | Notification channel and event subscription                                            |
| Import/export                | CSV in v1; Excel reserved                                                              |
| File storage                 | Local file system and S3-compatible storage                                            |
| S3 access                    | Private bucket access through backend authentication                                   |
| File size default            | 50 MB                                                                                  |
| File whitelist               | Images, documents, zip                                                                 |
| i18n languages               | Chinese and English                                                                    |
| PRD language                 | English                                                                                |
| Frontend                     | React + shadcn/ui + Tailwind CSS + Zustand                                             |
| Backend                      | Hono                                                                                   |
| Database                     | At least PostgreSQL and SQL Server                                                     |
| API base path                | `/api` in v1; future `/api/v2` allowed                                                 |
| Initialization               | Startup wizard and CLI/seed script                                                     |
| Sample module                | Cancelled; not included                                                                |
