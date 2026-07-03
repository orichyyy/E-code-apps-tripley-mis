import { Archive, Check, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { InAppNotification } from "./in-app-notification-api";
import { InAppNotificationStatusBadge } from "./in-app-notification-status";

type InAppNotificationTableProps = {
  canUpdate: boolean;
  isError: boolean;
  isLoading: boolean;
  onArchive: (record: InAppNotification) => void;
  onDelete: (record: InAppNotification) => void;
  onRead: (record: InAppNotification) => void;
  rows: InAppNotification[];
};

export function InAppNotificationTable({
  canUpdate,
  isError,
  isLoading,
  onArchive,
  onDelete,
  onRead,
  rows
}: InAppNotificationTableProps) {
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
            <th className="border-b px-4 py-3 font-medium">Title</th>
            <th className="border-b px-4 py-3 font-medium">Status</th>
            <th className="border-b px-4 py-3 font-medium">Body</th>
            <th className="border-b px-4 py-3 font-medium">Metadata</th>
            <th className="border-b px-4 py-3 font-medium">Created</th>
            <th className="border-b px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((record) => (
            <tr className="hover:bg-muted/40" key={record.id}>
              <td className="max-w-72 border-b px-4 py-3 font-medium">
                <span className="block truncate">{record.title}</span>
              </td>
              <td className="border-b px-4 py-3">
                <InAppNotificationStatusBadge status={record.status} />
              </td>
              <td className="max-w-96 truncate border-b px-4 py-3 text-muted-foreground">{record.body}</td>
              <td className="max-w-72 truncate border-b px-4 py-3 text-muted-foreground">
                {metadataSummary(record.metadata)}
              </td>
              <td className="border-b px-4 py-3 text-muted-foreground">{record.createdAt}</td>
              <td className="border-b px-4 py-3">
                <NotificationRowActions
                  canUpdate={canUpdate}
                  onArchive={onArchive}
                  onDelete={onDelete}
                  onRead={onRead}
                  record={record}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NotificationRowActions({
  canUpdate,
  onArchive,
  onDelete,
  onRead,
  record
}: {
  canUpdate: boolean;
  onArchive: (record: InAppNotification) => void;
  onDelete: (record: InAppNotification) => void;
  onRead: (record: InAppNotification) => void;
  record: InAppNotification;
}) {
  if (!canUpdate) return <span className="text-xs text-muted-foreground">View only</span>;

  return (
    <div className="flex gap-2">
      {record.status === "unread" ? (
        <Button onClick={() => onRead(record)} size="sm" variant="outline">
          <Check className="size-4" aria-hidden="true" />
          Read
        </Button>
      ) : null}
      {record.status !== "archived" ? (
        <Button onClick={() => onArchive(record)} size="sm" variant="ghost">
          <Archive className="size-4" aria-hidden="true" />
          Archive
        </Button>
      ) : null}
      <Button onClick={() => onDelete(record)} size="sm" variant="ghost">
        <Trash2 className="size-4" aria-hidden="true" />
        Delete
      </Button>
    </div>
  );
}

function metadataSummary(metadata: Record<string, unknown>): string {
  const entries = Object.entries(metadata);
  if (entries.length === 0) return "-";
  return entries
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join(", ");
}
