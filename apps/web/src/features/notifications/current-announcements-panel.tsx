import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2, Megaphone, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { translate } from "@/i18n/messages";
import { useAuthStore } from "@/stores/auth.store";
import { useLayoutStore } from "@/stores/layout.store";
import { useOrganizationStore } from "@/stores/organization.store";
import { fetchCurrentAnnouncements } from "./announcement-api";

export function CurrentAnnouncementsPanel() {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const language = useLayoutStore((state) => state.language);
  const accessToken = useAuthStore((state) => state.accessToken);
  const currentOrganizationId = useOrganizationStore((state) => state.currentOrganizationId);
  const query = useQuery({
    enabled: open && Boolean(accessToken && currentOrganizationId),
    queryKey: ["current-announcements", currentOrganizationId, page],
    queryFn: () => fetchCurrentAnnouncements({ page, pageSize: 10 }),
  });

  useEffect(() => setPage(1), [currentOrganizationId]);

  return (
    <>
      <Button
        aria-label={translate(language, "announcements.current")}
        onClick={() => setOpen(true)}
        size="icon"
        title={translate(language, "announcements.current")}
        variant="outline"
      >
        <Megaphone className="size-4" aria-hidden="true" />
      </Button>
      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            aria-label={translate(language, "actions.close")}
            className="absolute inset-0 bg-black/25"
            onClick={() => setOpen(false)}
            type="button"
          />
          <aside className="relative flex h-full w-full max-w-md flex-col border-l bg-background shadow-xl">
            <header className="flex h-16 items-center justify-between border-b px-5">
              <h2 className="text-base font-semibold">
                {translate(language, "announcements.current")}
              </h2>
              <Button
                aria-label={translate(language, "actions.close")}
                onClick={() => setOpen(false)}
                size="icon"
                variant="ghost"
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {query.isLoading ? (
                <PanelState loading text={translate(language, "common.loading")} />
              ) : null}
              {query.isError ? (
                <PanelState error text={translate(language, "common.error")} />
              ) : null}
              {query.data?.items.length === 0 ? (
                <PanelState text={translate(language, "announcements.empty")} />
              ) : null}
              {query.data?.items.map((announcement) => (
                <article className="border-b px-5 py-4" key={announcement.id}>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-medium leading-6">{announcement.title}</h3>
                    <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                      {announcement.scopeType === "system"
                        ? translate(language, "announcements.system")
                        : translate(language, "announcements.organization")}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                    {announcement.content}
                  </p>
                  <time className="mt-3 block text-xs text-muted-foreground">
                    {announcement.publishedAt
                      ? new Date(announcement.publishedAt).toLocaleString()
                      : ""}
                  </time>
                </article>
              ))}
            </div>
            <PanelPagination
              page={query.data?.page ?? page}
              pageSize={query.data?.pageSize ?? 10}
              total={query.data?.total ?? 0}
              onChange={setPage}
            />
          </aside>
        </div>
      ) : null}
    </>
  );
}

function PanelState({
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
      className={`flex items-center gap-2 px-5 py-8 text-sm ${error ? "text-destructive" : "text-muted-foreground"}`}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
      {text}
    </div>
  );
}

function PanelPagination({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const language = useLayoutStore((state) => state.language);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <footer className="flex h-14 items-center justify-between border-t px-4 text-sm text-muted-foreground">
      <span>{total}</span>
      <div className="flex items-center gap-2">
        <Button
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          size="icon"
          title={translate(language, "actions.previousPage")}
          variant="ghost"
        >
          <ChevronLeft className="size-4" />
          <span className="sr-only">{translate(language, "actions.previousPage")}</span>
        </Button>
        <span>
          {page} / {pages}
        </span>
        <Button
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
          size="icon"
          title={translate(language, "actions.nextPage")}
          variant="ghost"
        >
          <ChevronRight className="size-4" />
          <span className="sr-only">{translate(language, "actions.nextPage")}</span>
        </Button>
      </div>
    </footer>
  );
}
