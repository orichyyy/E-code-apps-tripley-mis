import { Inbox } from "lucide-react";

import type { InAppNotification } from "./in-app-notification-api";

export function InAppNotificationStatusBadge({ status }: { status: InAppNotification["status"] }) {
  const className =
    status === "unread"
      ? "bg-primary/10 text-primary"
      : status === "read"
        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        : status === "deleted"
          ? "bg-destructive/10 text-destructive"
          : "bg-muted text-muted-foreground";

  return (
    <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${className}`}>
      {status}
    </span>
  );
}

export function InAppNotificationSidePanel() {
  return (
    <section className="rounded-lg border bg-card p-4 text-sm shadow-sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-md bg-primary/10 p-2 text-primary">
          <Inbox className="size-4" aria-hidden="true" />
        </div>
        <div>
          <h3 className="font-semibold">Notification boundary</h3>
          <p className="mt-2 text-muted-foreground">
            This page manages the current user's durable in-app notification states only. Message
            creation and delivery fan-out remain backend infrastructure concerns.
          </p>
        </div>
      </div>
    </section>
  );
}
