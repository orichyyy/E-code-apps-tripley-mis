import { AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { displayValue, type CoreEntity } from "./core-management-model";

export type CoreColumn = {
  key: string;
  label: string;
  values: string[];
};

type CoreEntityTableProps = {
  columns: CoreColumn[];
  isError: boolean;
  isLoading: boolean;
  rows: CoreEntity[];
  selectedId?: string;
  onDelete?: (record: CoreEntity) => void;
  onEdit?: (record: CoreEntity) => void;
  onSelect?: (record: CoreEntity) => void;
  onStatusAction?: (record: CoreEntity, action: string) => void;
  statusActions?: (record: CoreEntity) => Array<{ action: string; label: string }>;
};

export function CoreEntityTable({
  columns,
  isError,
  isLoading,
  rows,
  selectedId,
  onDelete,
  onEdit,
  onSelect,
  onStatusAction,
  statusActions,
}: CoreEntityTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Loading
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-destructive">
        <AlertCircle className="size-4" aria-hidden="true" />
        The data could not be loaded.
      </div>
    );
  }

  if (rows.length === 0) {
    return <div className="p-8 text-sm text-muted-foreground">No records found.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
          <tr>
            {columns.map((column) => (
              <th className="border-b px-4 py-3 font-medium" key={column.key}>
                {column.label}
              </th>
            ))}
            <th className="border-b px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              className={row.id === selectedId ? "bg-muted/60" : "hover:bg-muted/40"}
              key={row.id}
            >
              {columns.map((column) => (
                <td className="border-b px-4 py-3" key={column.key}>
                  {column.key === "status" ? (
                    <span className="rounded border px-2 py-1 text-xs">
                      {displayValue(row, column.values, "active")}
                    </span>
                  ) : (
                    displayValue(row, column.values, "")
                  )}
                </td>
              ))}
              <td className="border-b px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  {onSelect ? (
                    <Button onClick={() => onSelect(row)} size="sm" variant="outline">
                      Select
                    </Button>
                  ) : null}
                  {onEdit ? (
                    <Button onClick={() => onEdit(row)} size="sm" variant="outline">
                      Edit
                    </Button>
                  ) : null}
                  {statusActions?.(row).map((item) => (
                    <Button
                      key={item.action}
                      onClick={() => onStatusAction?.(row, item.action)}
                      size="sm"
                      variant="ghost"
                    >
                      {item.label}
                    </Button>
                  ))}
                  {onDelete ? (
                    <Button onClick={() => onDelete(row)} size="sm" variant="ghost">
                      Delete
                    </Button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
