import { Loader2, Pencil, Send, Trash2, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { translate } from "@/i18n/messages";
import { useLayoutStore } from "@/stores/layout.store";
import type { Announcement } from "./announcement-api";
import { AnnouncementScopeBadge, AnnouncementStatusBadge } from "./announcement-status";

type AnnouncementTableProps = {
  canDelete: boolean;
  canPublish: boolean;
  canUpdate: boolean;
  isError: boolean;
  isLoading: boolean;
  onDelete: (record: Announcement) => void;
  onEdit: (record: Announcement) => void;
  onPublish: (record: Announcement) => void;
  onUnpublish: (record: Announcement) => void;
  rows: Announcement[];
};

export function AnnouncementTable(props: AnnouncementTableProps) {
  const language = useLayoutStore((state) => state.language);
  if (props.isLoading)
    return <TableState loading text={translate(language, "announcements.loading")} />;
  if (props.isError)
    return <TableState error text={translate(language, "announcements.loadError")} />;
  if (props.rows.length === 0)
    return <TableState text={translate(language, "announcements.catalogEmpty")} />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed border-collapse text-left text-sm">
        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="w-64 border-b px-4 py-3 font-medium">
              {translate(language, "announcements.title")}
            </th>
            <th className="w-36 border-b px-4 py-3 font-medium">
              {translate(language, "announcements.scope")}
            </th>
            <th className="w-28 border-b px-4 py-3 font-medium">
              {translate(language, "announcements.status")}
            </th>
            <th className="border-b px-4 py-3 font-medium">
              {translate(language, "announcements.content")}
            </th>
            <th className="w-48 border-b px-4 py-3 font-medium">
              {translate(language, "announcements.publishedAt")}
            </th>
            <th className="w-48 border-b px-4 py-3 font-medium">
              {translate(language, "announcements.expiresAt")}
            </th>
            <th className="w-44 border-b px-4 py-3 font-medium">
              {translate(language, "announcements.actions")}
            </th>
          </tr>
        </thead>
        <tbody>
          {props.rows.map((record) => (
            <AnnouncementRow key={record.id} {...props} record={record} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AnnouncementRow({ record, ...props }: AnnouncementTableProps & { record: Announcement }) {
  const language = useLayoutStore((state) => state.language);
  return (
    <tr className="hover:bg-muted/40">
      <td className="border-b px-4 py-3 font-medium">
        <span className="block truncate">{record.title}</span>
      </td>
      <td className="border-b px-4 py-3">
        <AnnouncementScopeBadge scopeType={record.scopeType} />
      </td>
      <td className="border-b px-4 py-3">
        <AnnouncementStatusBadge status={record.status} />
      </td>
      <td className="truncate border-b px-4 py-3 text-muted-foreground">{record.content}</td>
      <td className="border-b px-4 py-3 text-muted-foreground">{formatDate(record.publishedAt)}</td>
      <td className="border-b px-4 py-3 text-muted-foreground">{formatDate(record.expiresAt)}</td>
      <td className="border-b px-4 py-3">
        <div className="flex h-9 items-center gap-1">
          {props.canUpdate && record.status === "draft" ? (
            <Action
              icon={Pencil}
              label={translate(language, "announcements.editAction")}
              onClick={() => props.onEdit(record)}
            />
          ) : null}
          {props.canPublish && record.status === "draft" ? (
            <Action
              icon={Send}
              label={translate(language, "announcements.publishAction")}
              onClick={() => props.onPublish(record)}
            />
          ) : null}
          {props.canPublish && record.status === "published" ? (
            <Action
              icon={Undo2}
              label={translate(language, "announcements.unpublishAction")}
              onClick={() => props.onUnpublish(record)}
            />
          ) : null}
          {props.canDelete && record.status === "draft" ? (
            <Action
              destructive
              icon={Trash2}
              label={translate(language, "announcements.deleteAction")}
              onClick={() => props.onDelete(record)}
            />
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function Action({
  icon: Icon,
  label,
  onClick,
  destructive = false,
}: {
  icon: typeof Pencil;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <Button
      aria-label={label}
      className={destructive ? "text-destructive hover:text-destructive" : undefined}
      onClick={onClick}
      size="icon"
      title={label}
      variant="ghost"
    >
      <Icon className="size-4" aria-hidden="true" />
    </Button>
  );
}

function TableState({
  text,
  loading = false,
  error = false,
}: {
  text: string;
  loading?: boolean;
  error?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 p-8 text-sm ${error ? "text-destructive" : "text-muted-foreground"}`}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
      {text}
    </div>
  );
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "-";
}
