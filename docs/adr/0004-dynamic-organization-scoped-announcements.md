# Use dynamic current-organization visibility for scoped announcements

Organization-scoped Announcements target one or more minimal, non-overlapping Organization subtrees and are evaluated against the User's current Organization when read. The system does not create recipient snapshots: later membership changes affect visibility, overlapping targets produce one result, and the v1 rule that Organization nodes cannot move keeps subtree meaning stable.

The administrative Announcement Catalog remains separate from Current Announcements. Publishing changes lifecycle and visibility only; it does not create in-app notifications or trigger email, SMS, or Webhook delivery. This preserves Announcements as shared scoped content rather than turning them into per-user message deliveries.
