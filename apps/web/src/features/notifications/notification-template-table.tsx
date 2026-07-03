import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { NotificationTemplate } from "./notification-template-api";
import { NotificationChannelBadge, NotificationTemplateStatusBadge } from "./notification-template-status";

type NotificationTemplateTableProps = {
  canUpdate: boolean;
  isError: boolean;
  isLoading: boolean;
  onEdit: (record: NotificationTemplate) => void;
  rows: NotificationTemplate[];
};

export function NotificationTemplateTable({
  canUpdate,
  isError,
  isLoading,
  onEdit,
  rows
}: NotificationTemplateTableProps) {
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
            <th className="border-b px-4 py-3 font-medium">Code</th>
            <th className="border-b px-4 py-3 font-medium">Channel</th>
            <th className="border-b px-4 py-3 font-medium">Locale</th>
            <th className="border-b px-4 py-3 font-medium">Subject</th>
            <th className="border-b px-4 py-3 font-medium">Variables</th>
            <th className="border-b px-4 py-3 font-medium">Status</th>
            <th className="border-b px-4 py-3 font-medium">Updated</th>
            <th className="border-b px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((record) => (
            <tr className="hover:bg-muted/40" key={record.id}>
              <td className="border-b px-4 py-3 font-medium">{record.code}</td>
              <td className="border-b px-4 py-3">
                <NotificationChannelBadge channel={record.channel} />
              </td>
              <td className="border-b px-4 py-3 text-muted-foreground">{record.locale}</td>
              <td className="max-w-64 truncate border-b px-4 py-3">{record.subject || "-"}</td>
              <td className="max-w-72 truncate border-b px-4 py-3 text-muted-foreground">
                {record.variables.join(", ") || "-"}
              </td>
              <td className="border-b px-4 py-3">
                <NotificationTemplateStatusBadge status={record.status} />
              </td>
              <td className="border-b px-4 py-3 text-muted-foreground">{record.updatedAt}</td>
              <td className="border-b px-4 py-3">
                {canUpdate ? (
                  <Button onClick={() => onEdit(record)} size="sm" variant="outline">
                    Edit
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">View only</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
