import { CheckCircle2 } from "lucide-react";

import type { WebhookSubscription } from "@/lib/api-client";

export function WebhookSidePanel() {
  return (
    <section className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-md bg-primary/10 p-2 text-primary">
          <CheckCircle2 className="size-4" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">Subscription boundary</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            This page manages durable webhook subscription records only. Sender drivers and delivery retries remain reserved.
          </p>
        </div>
      </div>
    </section>
  );
}

export function WebhookStatusBadge({ status }: { status: WebhookSubscription["status"] }) {
  return (
    <span
      className={
        status === "enabled"
          ? "inline-flex rounded-md bg-emerald-500/10 px-2 py-1 text-xs text-emerald-700 dark:text-emerald-300"
          : "inline-flex rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"
      }
    >
      {status}
    </span>
  );
}
