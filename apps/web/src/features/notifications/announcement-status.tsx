import type { Announcement } from "./announcement-api";
import { translate } from "@/i18n/messages";
import { useLayoutStore } from "@/stores/layout.store";

export function AnnouncementStatusBadge({ status }: { status: Announcement["status"] }) {
  const language = useLayoutStore((state) => state.language);
  const className =
    status === "published"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : status === "deleted"
        ? "bg-destructive/10 text-destructive"
        : "bg-muted text-muted-foreground";

  return (
    <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${className}`}>
      {translate(
        language,
        status === "published"
          ? "announcements.published"
          : status === "deleted"
            ? "announcements.deleted"
            : "announcements.draft",
      )}
    </span>
  );
}

export function AnnouncementScopeBadge({ scopeType }: { scopeType: Announcement["scopeType"] }) {
  const language = useLayoutStore((state) => state.language);
  return (
    <span className="inline-flex rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
      {translate(
        language,
        scopeType === "organization" ? "announcements.organization" : "announcements.system",
      )}
    </span>
  );
}
