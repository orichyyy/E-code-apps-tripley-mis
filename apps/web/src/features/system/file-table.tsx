import { Download, Eye, ImageIcon, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { FileRecord } from "./file-api";
import { FileStatusBadge, formatBytes, ReferencedBadge } from "./file-status";

type FileTableProps = {
  canDelete: boolean;
  canDownload: boolean;
  canPreview: boolean;
  isError: boolean;
  isLoading: boolean;
  onDelete: (record: FileRecord) => void;
  onDetail: (record: FileRecord) => void;
  onDownload: (record: FileRecord) => void;
  onPreview: (record: FileRecord) => void;
  rows: FileRecord[];
};

export function FileTable({
  canDelete,
  canDownload,
  canPreview,
  isError,
  isLoading,
  onDelete,
  onDetail,
  onDownload,
  onPreview,
  rows
}: FileTableProps) {
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
            <th className="border-b px-4 py-3 font-medium">Type</th>
            <th className="border-b px-4 py-3 font-medium">Size</th>
            <th className="border-b px-4 py-3 font-medium">Storage</th>
            <th className="border-b px-4 py-3 font-medium">Reference</th>
            <th className="border-b px-4 py-3 font-medium">Status</th>
            <th className="border-b px-4 py-3 font-medium">Created</th>
            <th className="border-b px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((record) => (
            <tr className="hover:bg-muted/40" key={record.id}>
              <td className="border-b px-4 py-3">
                <div className="font-medium">{record.originalName}</div>
                <div className="max-w-72 truncate text-xs text-muted-foreground">{record.objectKey}</div>
              </td>
              <td className="border-b px-4 py-3">
                <div>{record.extension || "-"}</div>
                <div className="text-xs text-muted-foreground">{record.contentType || "-"}</div>
              </td>
              <td className="border-b px-4 py-3">{formatBytes(record.sizeBytes)}</td>
              <td className="border-b px-4 py-3 text-muted-foreground">{record.storageDriver}</td>
              <td className="border-b px-4 py-3">
                <ReferencedBadge referenced={record.referenced} />
              </td>
              <td className="border-b px-4 py-3">
                <FileStatusBadge isDeleted={record.isDeleted} status={record.status} />
              </td>
              <td className="border-b px-4 py-3 text-muted-foreground">{record.createdAt}</td>
              <td className="border-b px-4 py-3">
                <FileRowActions
                  canDelete={canDelete}
                  canDownload={canDownload}
                  canPreview={canPreview}
                  onDelete={onDelete}
                  onDetail={onDetail}
                  onDownload={onDownload}
                  onPreview={onPreview}
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

function FileRowActions({
  canDelete,
  canDownload,
  canPreview,
  onDelete,
  onDetail,
  onDownload,
  onPreview,
  record
}: {
  canDelete: boolean;
  canDownload: boolean;
  canPreview: boolean;
  onDelete: (record: FileRecord) => void;
  onDetail: (record: FileRecord) => void;
  onDownload: (record: FileRecord) => void;
  onPreview: (record: FileRecord) => void;
  record: FileRecord;
}) {
  const deleteDisabled = record.isDeleted || record.status === "invalid";
  const isImage = record.contentType.startsWith("image/");

  return (
    <div className="flex gap-2">
      <Button onClick={() => onDetail(record)} size="sm" variant="outline">
        <Eye className="size-4" aria-hidden="true" />
        Details
      </Button>
      {canDownload ? (
        <Button disabled={deleteDisabled} onClick={() => onDownload(record)} size="sm" variant="ghost">
          <Download className="size-4" aria-hidden="true" />
          Download
        </Button>
      ) : null}
      {canPreview && isImage ? (
        <Button disabled={deleteDisabled} onClick={() => onPreview(record)} size="sm" variant="ghost">
          <ImageIcon className="size-4" aria-hidden="true" />
          Preview
        </Button>
      ) : null}
      {canDelete ? (
        <Button disabled={deleteDisabled} onClick={() => onDelete(record)} size="sm" variant="ghost">
          <Trash2 className="size-4" aria-hidden="true" />
          Invalidate
        </Button>
      ) : null}
    </div>
  );
}
