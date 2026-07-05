import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ImportExportTask } from "./operations-api";
import { EmptyState, ErrorState, StatusBadge } from "./status-badge";

export function ImportExportTable({
  isError,
  isLoading,
  onSelect,
  rows,
  selectedId,
}: {
  isError: boolean;
  isLoading: boolean;
  onSelect: (id: string) => void;
  rows: ImportExportTask[];
  selectedId: string | null;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Loading data
      </div>
    );
  }
  if (isError) return <ErrorState text="The data could not be loaded." />;
  if (rows.length === 0) return <EmptyState text="No records match the current filters." />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="border-b px-4 py-3 font-medium">Task</th>
            <th className="border-b px-4 py-3 font-medium">Rows</th>
            <th className="border-b px-4 py-3 font-medium">Files</th>
            <th className="border-b px-4 py-3 font-medium">Status</th>
            <th className="border-b px-4 py-3 font-medium">Created</th>
            <th className="border-b px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((record) => (
            <tr
              className={record.id === selectedId ? "bg-muted/40" : "hover:bg-muted/40"}
              key={record.id}
            >
              <td className="border-b px-4 py-3">
                <div className="font-medium">{record.resourceType}</div>
                <div className="text-xs text-muted-foreground">{record.taskType}</div>
              </td>
              <td className="border-b px-4 py-3 text-muted-foreground">
                {record.successRows}/{record.totalRows}
                {record.failedRows > 0 ? (
                  <span className="ml-2 text-destructive">{record.failedRows} failed</span>
                ) : null}
              </td>
              <td className="border-b px-4 py-3 text-muted-foreground">
                <div>Result {record.resultFileObjectId ?? "-"}</div>
                <div className="text-xs">Error {record.errorFileObjectId ?? "-"}</div>
              </td>
              <td className="border-b px-4 py-3">
                <StatusBadge>{record.status}</StatusBadge>
              </td>
              <td className="border-b px-4 py-3 text-muted-foreground">
                {record.createdAt || "-"}
              </td>
              <td className="border-b px-4 py-3">
                <Button onClick={() => onSelect(record.id)} size="sm" variant="outline">
                  View
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
