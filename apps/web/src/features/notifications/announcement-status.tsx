import { Megaphone } from "lucide-react";

import type { Announcement } from "./announcement-api";

export function AnnouncementStatusBadge({ status }: { status: Announcement["status"] }) {
  const className =
    status === "published"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : status === "deleted"
        ? "bg-destructive/10 text-destructive"
        : "bg-muted text-muted-foreground";

  return <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${className}`}>{status}</span>;
}

export function AnnouncementScopeBadge({ scopeType }: { scopeType: Announcement["scopeType"] }) {
  return (
    <span className="inline-flex rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
      {scopeType === "organization" ? "organization" : "system"}
    </span>
  );
}

export function AnnouncementSidePanel() {
  return (
    <section className="rounded-lg border bg-card p-4 text-sm shadow-sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-md bg-primary/10 p-2 text-primary">
          <Megaphone className="size-4" aria-hidden="true" />
        </div>
        <div>
          <h3 className="font-semibold">Announcement boundary</h3>
          <p className="mt-2 text-muted-foreground">
            This page manages durable announcement records and publication state only. Notification delivery, webhook
            dispatch, email, and SMS fan-out remain separate reserved integrations.
          </p>
        </div>
      </div>
    </section>
  );
}
