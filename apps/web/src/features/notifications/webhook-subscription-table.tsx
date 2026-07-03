import { Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { WebhookSubscription } from "@/lib/api-client";
import { WebhookStatusBadge } from "./webhook-status";

type WebhookTableProps = {
  canUpdate: boolean;
  isError: boolean;
  isLoading: boolean;
  onEdit: (record: WebhookSubscription) => void;
  onToggle: (record: WebhookSubscription) => void;
  rows: WebhookSubscription[];
};

export function WebhookSubscriptionTable({
  canUpdate,
  isError,
  isLoading,
  onEdit,
  onToggle,
  rows
}: WebhookTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Loading data
      </div>
    );
  }
  if (isError) return <div className="p-8 text-sm text-destructive">The data could not be loaded.</div>;
  if (rows.length === 0) {
    return <div className="p-8 text-sm text-muted-foreground">No records match the current filters.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="border-b px-4 py-3 font-medium">Name</th>
            <th className="border-b px-4 py-3 font-medium">URL</th>
            <th className="border-b px-4 py-3 font-medium">Events</th>
            <th className="border-b px-4 py-3 font-medium">Secret</th>
            <th className="border-b px-4 py-3 font-medium">Status</th>
            <th className="border-b px-4 py-3 font-medium">Updated</th>
            <th className="border-b px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((record) => (
            <tr className="hover:bg-muted/40" key={record.id}>
              <td className="border-b px-4 py-3 font-medium">{record.name}</td>
              <td className="max-w-72 truncate border-b px-4 py-3 text-muted-foreground">{record.url}</td>
              <td className="border-b px-4 py-3">{record.eventTypes.join(", ") || "-"}</td>
              <td className="border-b px-4 py-3">
                <SecretState configured={record.secretConfigured} />
              </td>
              <td className="border-b px-4 py-3">
                <WebhookStatusBadge status={record.status} />
              </td>
              <td className="border-b px-4 py-3 text-muted-foreground">{record.updatedAt}</td>
              <td className="border-b px-4 py-3">
                <WebhookRowActions canUpdate={canUpdate} onEdit={onEdit} onToggle={onToggle} record={record} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SecretState({ configured }: { configured: boolean }) {
  return configured ? (
    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-xs text-emerald-700 dark:text-emerald-300">
      <ShieldCheck className="size-3" aria-hidden="true" />
      Configured
    </span>
  ) : (
    <span className="text-muted-foreground">Not configured</span>
  );
}

function WebhookRowActions({
  canUpdate,
  onEdit,
  onToggle,
  record
}: {
  canUpdate: boolean;
  onEdit: (record: WebhookSubscription) => void;
  onToggle: (record: WebhookSubscription) => void;
  record: WebhookSubscription;
}) {
  return (
    <div className="flex gap-2">
      {canUpdate ? (
        <>
          <Button onClick={() => onEdit(record)} size="sm" variant="outline">
            Edit
          </Button>
          <Button onClick={() => onToggle(record)} size="sm" variant="ghost">
            {record.status === "enabled" ? "Disable" : "Enable"}
          </Button>
        </>
      ) : (
        <span className="text-xs text-muted-foreground">View only</span>
      )}
    </div>
  );
}
