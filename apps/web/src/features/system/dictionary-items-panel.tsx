import { Loader2, Plus, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, StatusBadge } from "@/features/operations/status-badge";
import type { DictionaryItem, DictionaryType } from "./system-management-api";

type DictionaryItemsPanelProps = {
  canCreate: boolean;
  canUpdate: boolean;
  isError: boolean;
  isLoading: boolean;
  onCreate: () => void;
  onEdit: (record: DictionaryItem) => void;
  onRefresh: () => void;
  onStatus: (record: DictionaryItem, status: "enabled" | "disabled") => void;
  rows: DictionaryItem[];
  selectedType: DictionaryType | null;
};

export function DictionaryItemsPanel({
  canCreate,
  canUpdate,
  isError,
  isLoading,
  onCreate,
  onEdit,
  onRefresh,
  onStatus,
  rows,
  selectedType
}: DictionaryItemsPanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold">{selectedType?.name ?? "Dictionary items"}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedType ? selectedType.description ?? selectedType.code : "Select a dictionary type to manage items."}
            </p>
          </div>
          <div className="flex gap-2">
            <Button disabled={!selectedType} onClick={onRefresh} size="sm" variant="outline">
              <RefreshCw className="size-4" aria-hidden="true" />
              Refresh
            </Button>
            {canCreate ? (
              <Button disabled={!selectedType} onClick={onCreate} size="sm">
                <Plus className="size-4" aria-hidden="true" />
                Item
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      <div className="rounded-lg border bg-card shadow-sm">
        <DictionaryItemTable
          canUpdate={canUpdate}
          isError={isError}
          isLoading={isLoading}
          onEdit={onEdit}
          onStatus={onStatus}
          rows={rows}
          selectedType={selectedType}
        />
      </div>
    </div>
  );
}

function DictionaryItemTable({
  canUpdate,
  isError,
  isLoading,
  onEdit,
  onStatus,
  rows,
  selectedType
}: {
  canUpdate: boolean;
  isError: boolean;
  isLoading: boolean;
  onEdit: (record: DictionaryItem) => void;
  onStatus: (record: DictionaryItem, status: "enabled" | "disabled") => void;
  rows: DictionaryItem[];
  selectedType: DictionaryType | null;
}) {
  if (!selectedType) return <EmptyState text="Select a dictionary type first." />;
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
            <th className="border-b px-4 py-3 font-medium">Value</th>
            <th className="border-b px-4 py-3 font-medium">Label key</th>
            <th className="border-b px-4 py-3 font-medium">Sort</th>
            <th className="border-b px-4 py-3 font-medium">Status</th>
            <th className="border-b px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((record) => (
            <tr className="hover:bg-muted/40" key={record.id}>
              <td className="border-b px-4 py-3 font-medium">{record.itemValue}</td>
              <td className="border-b px-4 py-3 text-muted-foreground">{record.labelI18nKey}</td>
              <td className="border-b px-4 py-3 text-muted-foreground">{record.sortOrder}</td>
              <td className="border-b px-4 py-3">
                <StatusBadge>{record.status}</StatusBadge>
              </td>
              <td className="border-b px-4 py-3">
                <div className="flex gap-2">
                  {canUpdate ? (
                    <Button onClick={() => onEdit(record)} size="sm" variant="outline">
                      Edit
                    </Button>
                  ) : null}
                  {canUpdate ? (
                    <Button
                      onClick={() => onStatus(record, record.status === "enabled" ? "disabled" : "enabled")}
                      size="sm"
                      variant="ghost"
                    >
                      {record.status === "enabled" ? "Disable" : "Enable"}
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
