import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Announcement } from "./announcement-api";
import { AnnouncementScopeBadge, AnnouncementStatusBadge } from "./announcement-status";

type AnnouncementTableProps = {
  canPublish: boolean;
  canUpdate: boolean;
  isError: boolean;
  isLoading: boolean;
  onEdit: (record: Announcement) => void;
  onPublish: (record: Announcement) => void;
  onUnpublish: (record: Announcement) => void;
  rows: Announcement[];
};

export function AnnouncementTable({
  canPublish,
  canUpdate,
  isError,
  isLoading,
  onEdit,
  onPublish,
  onUnpublish,
  rows,
}: AnnouncementTableProps) {
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
            <th className="border-b px-4 py-3 font-medium">Title</th>
            <th className="border-b px-4 py-3 font-medium">Scope</th>
            <th className="border-b px-4 py-3 font-medium">Status</th>
            <th className="border-b px-4 py-3 font-medium">Content</th>
            <th className="border-b px-4 py-3 font-medium">Published</th>
            <th className="border-b px-4 py-3 font-medium">Updated</th>
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
                <AnnouncementScopeBadge scopeType={record.scopeType} />
              </td>
              <td className="border-b px-4 py-3">
                <AnnouncementStatusBadge status={record.status} />
              </td>
              <td className="max-w-96 truncate border-b px-4 py-3 text-muted-foreground">
                {record.content}
              </td>
              <td className="border-b px-4 py-3 text-muted-foreground">
                {record.publishedAt ?? "-"}
              </td>
              <td className="border-b px-4 py-3 text-muted-foreground">{record.updatedAt}</td>
              <td className="border-b px-4 py-3">
                <AnnouncementRowActions
                  canPublish={canPublish}
                  canUpdate={canUpdate}
                  onEdit={onEdit}
                  onPublish={onPublish}
                  onUnpublish={onUnpublish}
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

function AnnouncementRowActions({
  canPublish,
  canUpdate,
  onEdit,
  onPublish,
  onUnpublish,
  record,
}: {
  canPublish: boolean;
  canUpdate: boolean;
  onEdit: (record: Announcement) => void;
  onPublish: (record: Announcement) => void;
  onUnpublish: (record: Announcement) => void;
  record: Announcement;
}) {
  if (!canUpdate && !canPublish)
    return <span className="text-xs text-muted-foreground">View only</span>;

  return (
    <div className="flex gap-2">
      {canUpdate ? (
        <Button onClick={() => onEdit(record)} size="sm" variant="outline">
          Edit
        </Button>
      ) : null}
      {canPublish && record.status !== "published" ? (
        <Button onClick={() => onPublish(record)} size="sm" variant="ghost">
          Publish
        </Button>
      ) : null}
      {canPublish && record.status === "published" ? (
        <Button onClick={() => onUnpublish(record)} size="sm" variant="ghost">
          Unpublish
        </Button>
      ) : null}
    </div>
  );
}
