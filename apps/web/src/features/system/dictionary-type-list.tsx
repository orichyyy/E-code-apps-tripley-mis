import { Loader2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, StatusBadge } from "@/features/operations/status-badge";
import { cn } from "@/lib/utils";
import type { DictionaryType } from "./system-management-api";

type DictionaryTypeListProps = {
  canUpdate: boolean;
  isError: boolean;
  isLoading: boolean;
  keyword: string;
  onEdit: (record: DictionaryType) => void;
  onKeywordChange: (value: string) => void;
  onSelect: (record: DictionaryType) => void;
  onStatus: (record: DictionaryType, status: "enabled" | "disabled") => void;
  rows: DictionaryType[];
  selectedId: string | null;
};

export function DictionaryTypeList({
  canUpdate,
  isError,
  isLoading,
  keyword,
  onEdit,
  onKeywordChange,
  onSelect,
  onStatus,
  rows,
  selectedId
}: DictionaryTypeListProps) {
  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="border-b p-4">
        <label className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
          <Search className="size-4 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">Filter</span>
          <input
            className="w-full bg-transparent outline-none"
            onChange={(event) => onKeywordChange(event.target.value)}
            placeholder="Filter dictionary types"
            value={keyword}
          />
        </label>
      </div>
      {isLoading ? (
        <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading data
        </div>
      ) : isError ? (
        <ErrorState text="The data could not be loaded." />
      ) : rows.length === 0 ? (
        <EmptyState text="No records match the current filters." />
      ) : (
        <div className="divide-y">
          {rows.map((record) => (
            <div
              className={cn(
                "block w-full cursor-pointer p-4 text-left text-sm hover:bg-muted/40",
                record.id === selectedId ? "bg-muted/40" : ""
              )}
              key={record.id}
              onClick={() => onSelect(record)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") onSelect(record);
              }}
              role="button"
              tabIndex={0}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{record.name}</div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">{record.code}</div>
                </div>
                <StatusBadge>{record.status}</StatusBadge>
              </div>
              <div className="mt-3 flex gap-2">
                {canUpdate ? (
                  <Button
                    onClick={(event) => {
                      event.stopPropagation();
                      onEdit(record);
                    }}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Edit
                  </Button>
                ) : null}
                {canUpdate ? (
                  <Button
                    onClick={(event) => {
                      event.stopPropagation();
                      onStatus(record, record.status === "enabled" ? "disabled" : "enabled");
                    }}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    {record.status === "enabled" ? "Disable" : "Enable"}
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
