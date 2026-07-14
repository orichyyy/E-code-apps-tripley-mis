# Web Admin Base System

This context defines the domain language shared by the base system. It excludes business-module concepts and implementation details.

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
