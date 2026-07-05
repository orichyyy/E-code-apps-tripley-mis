import { Languages, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { I18nMessage } from "./i18n-message-api";

type I18nMessageTableProps = {
  canUpdate: boolean;
  isError: boolean;
  isLoading: boolean;
  onEdit: (record: I18nMessage) => void;
  rows: I18nMessage[];
};

export function I18nMessageTable({
  canUpdate,
  isError,
  isLoading,
  onEdit,
  rows,
}: I18nMessageTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Loading data
      </div>
    );
  }
  if (isError)
    return <div className="p-8 text-sm text-destructive">The data could not be loaded.</div>;
  if (rows.length === 0) {
    return (
      <div className="p-8 text-sm text-muted-foreground">No records match the current filters.</div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="border-b px-4 py-3 font-medium">Key</th>
            <th className="border-b px-4 py-3 font-medium">Language</th>
            <th className="border-b px-4 py-3 font-medium">Module</th>
            <th className="border-b px-4 py-3 font-medium">Value</th>
            <th className="border-b px-4 py-3 font-medium">Updated</th>
            <th className="border-b px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((record) => (
            <tr className="hover:bg-muted/40" key={record.id}>
              <td className="max-w-72 border-b px-4 py-3 font-medium">
                <span className="block truncate">{record.messageKey}</span>
              </td>
              <td className="border-b px-4 py-3">
                <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                  <Languages className="size-3" aria-hidden="true" />
                  {record.language}
                </span>
              </td>
              <td className="border-b px-4 py-3 text-muted-foreground">{record.module || "-"}</td>
              <td className="max-w-96 truncate border-b px-4 py-3">{record.messageValue}</td>
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
