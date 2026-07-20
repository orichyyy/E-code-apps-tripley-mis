# Web Admin Base System

This context defines the domain language shared by the Base System, including its Business Module extension boundary. It excludes concepts from any specific business domain and all implementation details.

## Module Extensions

**Business Module**:
A cohesive administrative capability added to the Base System for a specific business domain.
_Avoid_: Plugin, Base Module

**Business Module Definition**:
The authoritative declaration of a Business Module's identity and its required Base System integration points.
_Avoid_: Plugin manifest, module configuration

**Business Module Registry**:
The authoritative set of Business Module Definitions included in one system release.
_Avoid_: Plugin catalog, discovered modules

**Module Code**:
The globally unique and permanent identity of a Business Module and the namespace for everything that module owns.
_Avoid_: Display name, package name

**Module Contribution**:
One Base System integration declaration owned by a Business Module, such as a permission, route, data resource, event, or task.
_Avoid_: Plugin hook, extension setting

**Module Sync Plan**:
The immutable proposed difference between a Business Module Registry and the module metadata currently accepted by an administrator.
_Avoid_: Module installation, migration plan

**Active Business Module**:
A Business Module whose security and runtime contract has been accepted for the current release.
_Avoid_: Installed plugin, enabled package

**Pending Business Module**:
A Business Module included in the current release whose new or changed security and runtime contract has not yet been accepted.
_Avoid_: Disabled plugin, broken module

**Localized Message**:
User-facing text identified by a stable message key and a Default Message, with optional translations for additional languages.
_Avoid_: Literal UI text, magic translation prefix

**Default Message**:
The text shown when a Localized Message has no translation for the User's Effective Language.
_Avoid_: Translation key, missing-translation marker

**Single-Locale Business Module**:
A Business Module that initially supplies Localized Messages only in its default language while remaining compatible with the Base System's internationalization lifecycle.
_Avoid_: Non-i18n module, literal-only module

**Policy-Controlled Resource**:
A Business Module resource whose visible records are constrained by effective Data Permission rules in the current User and Organization context.
_Avoid_: Filtered table, organization data

**Global Resource**:
A Business Module resource that is shared across Organization contexts and does not use Data Permission rules.
_Avoid_: Unprotected resource, public data

**Operation Event**:
An auditable User or Worker action against a declared resource, recorded with its outcome and execution context.
_Avoid_: API log, access log

**Domain Event**:
An immutable business fact emitted by a Business Module without selecting recipients.
_Avoid_: Notification Event, queue job

**Notification Event**:
A directed intent to notify one or more Users through declared channels and templates.
_Avoid_: Domain Event, arbitrary message

## Files

**Managed File**:
A file registered by the base system and tracked through an active or invalid lifecycle.
_Avoid_: Raw file, attachment

**File Reference**:
A relationship from another system record to a Managed File. The relationship remains visible but becomes invalid when the Managed File is deleted.
_Avoid_: Embedded file

**Private Download**:
Access to a Managed File that is granted only after the current user is authenticated and authorized, regardless of which storage service transfers the content.
_Avoid_: Public URL, permanent link

**Object Location**:
The durable address of a Managed File's content, consisting of its storage driver, optional storage bucket, and object key.
_Avoid_: File path, download URL

**Content Deletion**:
The completed removal of a Managed File's stored content after the Managed File and its references have already become invalid.
_Avoid_: Logical deletion, reference deletion

## Announcements

**Announcement Target**:
One Organization explicitly selected as an audience for an organization-scoped Announcement. A target includes that Organization and its entire descendant subtree, and one Announcement may have multiple distinct Announcement Targets.
_Avoid_: Announcement recipient, scope value

**Announcement Visibility**:
The eligibility of an Announcement in a User's current Organization context. System-wide Announcements are context-independent; organization-scoped Announcements require the current Organization to fall within an Announcement Target subtree.
_Avoid_: Notification assignment, inbox delivery

**Announcement Catalog**:
The administrative collection of Announcements across lifecycle states and target scopes. It supports management and audit work and is not filtered by a User's Announcement Visibility.
_Avoid_: Current announcements, announcement feed

**Current Announcements**:
The distinct set of published Announcements visible in a User's current Organization context. It excludes drafts and deleted Announcements and collapses overlapping Announcement Targets.
_Avoid_: Announcement catalog, notification inbox

## Webhooks

**Webhook Subscription**:
A managed external endpoint authorized to receive selected Webhook Event types.
_Avoid_: Callback, webhook URL

**Webhook Event**:
An immutable, externally visible fact or directed notification represented by a stable event type and event identifier.
_Avoid_: Queue job, internal event, callback payload

**Webhook Delivery**:
The durable relationship between one Webhook Event and one revision of its target Webhook Subscription, including its overall outcome.
_Avoid_: Webhook job, request

**Delivery Attempt**:
One authenticated HTTP request made as part of a Webhook Delivery.
_Avoid_: Retry, delivery

## Email Notifications

**Email Notification Request**:
An internal request to notify one User by email using a named Email Template and template variables.
_Avoid_: Email blast, arbitrary email

**Email Request Key**:
A caller-assigned identifier that makes repeated submission of the same Email Notification Request return the same Email Delivery for the same User.
_Avoid_: Database ID, business reference

**Email Delivery**:
The durable outcome of sending one rendered email to the address and language selected for one User when the Email Notification Request was accepted.
_Avoid_: Email job, SMTP request

**Email Delivery Attempt**:
One SMTP send operation made as part of an Email Delivery.
_Avoid_: Retry, email delivery

**SMTP Acceptance**:
The SMTP server's successful acknowledgement after receiving the complete message; it does not prove delivery to the recipient's inbox.
_Avoid_: Inbox delivery, message read

**Email Message ID**:
A stable identifier assigned to one Email Delivery and reused by every Email Delivery Attempt to support downstream duplicate detection.
_Avoid_: Attempt ID, request key

**Email Content Snapshot**:
The recipient address, language, subject, and body fixed when an Email Delivery is created so later profile or template changes do not alter that delivery.
_Avoid_: Current template, live user email

**Effective Language**:
The User's personal language override when present, otherwise the administrator-selected system default language.
_Avoid_: Email fallback language, browser language

**Email Template**:
A language-specific notification template whose subject, body, and declared variables form one rendering contract.
_Avoid_: Email draft, arbitrary HTML

**Template Variable Contract**:
The exact set of primitive values required to render an Email Template without undeclared, missing, or unused variables.
_Avoid_: Free-form metadata, template context
