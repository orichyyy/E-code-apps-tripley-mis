import { Bell, Mail, MessageSquareText } from "lucide-react";

import type { NotificationTemplate } from "./notification-template-api";

export function NotificationTemplateStatusBadge({ status }: { status: NotificationTemplate["status"] }) {
  const className =
    status === "enabled"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : "bg-muted text-muted-foreground";

  return <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${className}`}>{status}</span>;
}

export function NotificationChannelBadge({ channel }: { channel: NotificationTemplate["channel"] }) {
  const Icon = channel === "email" ? Mail : channel === "sms" ? MessageSquareText : Bell;
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
      <Icon className="size-3" aria-hidden="true" />
      {channel}
    </span>
  );
}

export function NotificationTemplateSidePanel() {
  return (
    <section className="rounded-lg border bg-card p-4 text-sm shadow-sm">
      <h3 className="font-semibold">Template boundary</h3>
      <p className="mt-2 text-muted-foreground">
        Manage persisted in-app, email, and reserved SMS template records. Delivery drivers and outbound sending remain
        optional integrations outside this page.
      </p>
      <div className="mt-4 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
        Variables are stored as a list of supported placeholders and are edited as comma-separated names.
      </div>
    </section>
  );
}
