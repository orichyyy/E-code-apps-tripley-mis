import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateAnnouncementRequest,
  ListAnnouncementsQuery,
  UpdateAnnouncementRequest,
} from "@web-admin-base/contracts";
import { AlertCircle, ChevronLeft, ChevronRight, Plus, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { hasPermission } from "@/features/permissions/permission-utils";
import { translate } from "@/i18n/messages";
import type { WebAdminRouteMetadata } from "@/route-metadata";
import { useAuthStore } from "@/stores/auth.store";
import { useLayoutStore } from "@/stores/layout.store";
import {
  createAnnouncement,
  deleteAnnouncement,
  fetchAnnouncementOrganizations,
  fetchAnnouncements,
  publishAnnouncement,
  unpublishAnnouncement,
  updateAnnouncement,
  type Announcement,
} from "./announcement-api";
import {
  AnnouncementFilters,
  emptyAnnouncementFilters,
  type AnnouncementFilterValues,
} from "./announcement-filters";
import { AnnouncementForm } from "./announcement-form";
import { AnnouncementTable } from "./announcement-table";

export function AnnouncementsPage({ route }: { route: WebAdminRouteMetadata }) {
  const language = useLayoutStore((state) => state.language);
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const permissions = useMemo(
    () => ({
      view: hasPermission(permissionCodes, route.requiredPermission),
      create: hasPermission(permissionCodes, "announcement:create"),
      update: hasPermission(permissionCodes, "announcement:update"),
      publish: hasPermission(permissionCodes, "announcement:publish"),
      delete: hasPermission(permissionCodes, "announcement:delete"),
    }),
    [permissionCodes, route.requiredPermission],
  );
  const [filters, setFilters] = useState<AnnouncementFilterValues>(emptyAnnouncementFilters);
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const apiQuery = useMemo(() => toApiQuery(filters, page), [filters, page]);
  const queryClient = useQueryClient();
  const query = useQuery({
    enabled: permissions.view,
    queryKey: ["announcements", apiQuery],
    queryFn: () => fetchAnnouncements(apiQuery),
  });
  const organizationQuery = useQuery({
    enabled: permissions.view && (permissions.create || permissions.update),
    queryKey: ["announcement-organizations"],
    queryFn: fetchAnnouncementOrganizations,
  });
  const mutations = useAnnouncementMutations(queryClient, {
    closeCreate: () => setCreating(false),
    closeEdit: () => setEditing(null),
  });

  if (!permissions.view) return <PermissionDenied language={language} />;

  return (
    <section
      className={
        creating || editing ? "grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]" : "space-y-4"
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 border-b pb-4">
          <h2 className="text-base font-semibold">{translate(language, route.titleI18nKey)}</h2>
          <div className="flex gap-2">
            <Button
              onClick={() => void query.refetch()}
              size="icon"
              title={translate(language, "actions.refresh")}
              variant="outline"
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              <span className="sr-only">{translate(language, "actions.refresh")}</span>
            </Button>
            {permissions.create ? (
              <Button
                onClick={() => {
                  setEditing(null);
                  setCreating(true);
                }}
                size="sm"
              >
                <Plus className="size-4" aria-hidden="true" />
                {translate(language, "actions.create")}
              </Button>
            ) : null}
          </div>
        </div>
        <div className="rounded-lg border bg-card shadow-sm">
          <AnnouncementFilters
            value={filters}
            onChange={(next) => {
              setFilters(next);
              setPage(1);
            }}
          />
          <AnnouncementTable
            canDelete={permissions.delete}
            canPublish={permissions.publish}
            canUpdate={permissions.update}
            isError={query.isError}
            isLoading={query.isLoading}
            onDelete={(record) => {
              if (window.confirm(translate(language, "announcements.deleteConfirm")))
                mutations.remove.mutate(record.id);
            }}
            onEdit={(record) => {
              setCreating(false);
              setEditing(record);
            }}
            onPublish={(record) => mutations.publish.mutate(record.id)}
            onUnpublish={(record) => mutations.unpublish.mutate(record.id)}
            rows={query.data?.items ?? []}
          />
          <Pagination
            page={query.data?.page ?? page}
            pageSize={query.data?.pageSize ?? 20}
            total={query.data?.total ?? 0}
            onChange={setPage}
          />
        </div>
      </div>
      {creating || editing ? (
        <aside className="space-y-3">
          <AnnouncementForm
            busy={mutations.create.isPending || mutations.update.isPending}
            initialRecord={editing ?? undefined}
            key={editing?.id ?? "create"}
            mode={editing ? "edit" : "create"}
            organizations={organizationQuery.data ?? []}
            onCancel={() => {
              setCreating(false);
              setEditing(null);
            }}
            onSubmit={(input) => {
              if (editing) {
                mutations.update.mutate({
                  id: editing.id,
                  input: input as UpdateAnnouncementRequest,
                });
              } else {
                mutations.create.mutate(input as CreateAnnouncementRequest);
              }
            }}
          />
          {mutationFailed(mutations) ? (
            <p className="text-sm text-destructive">
              {translate(language, "announcements.saveError")}
            </p>
          ) : null}
        </aside>
      ) : null}
    </section>
  );
}

function useAnnouncementMutations(
  queryClient: ReturnType<typeof useQueryClient>,
  callbacks: { closeCreate: () => void; closeEdit: () => void },
) {
  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["announcements"] }),
      queryClient.invalidateQueries({ queryKey: ["current-announcements"] }),
    ]);
  };
  return {
    create: useMutation({
      mutationFn: createAnnouncement,
      onSuccess: async () => {
        callbacks.closeCreate();
        await invalidate();
      },
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: UpdateAnnouncementRequest }) =>
        updateAnnouncement(id, input),
      onSuccess: async () => {
        callbacks.closeEdit();
        await invalidate();
      },
    }),
    publish: useMutation({ mutationFn: publishAnnouncement, onSuccess: invalidate }),
    unpublish: useMutation({ mutationFn: unpublishAnnouncement, onSuccess: invalidate }),
    remove: useMutation({ mutationFn: deleteAnnouncement, onSuccess: invalidate }),
  };
}

function toApiQuery(filters: AnnouncementFilterValues, page: number): ListAnnouncementsQuery {
  return {
    status: filters.status || undefined,
    scopeType: filters.scopeType || undefined,
    publishedFrom: filters.publishedFrom
      ? new Date(filters.publishedFrom).toISOString()
      : undefined,
    publishedTo: filters.publishedTo ? new Date(filters.publishedTo).toISOString() : undefined,
    page,
    pageSize: 20,
  };
}

function Pagination({
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
    <div className="flex h-12 items-center justify-between border-t px-4 text-sm text-muted-foreground">
      <span>
        {total} {translate(language, "announcements.records")}
      </span>
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
        <span className="min-w-16 text-center">
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
    </div>
  );
}

function PermissionDenied({ language }: { language: "en" | "zh" }) {
  return (
    <section className="rounded-lg border bg-card p-8 text-center">
      <AlertCircle className="mx-auto size-8 text-destructive" aria-hidden="true" />
      <h2 className="mt-3 text-base font-semibold">
        {translate(language, "common.permissionDenied")}
      </h2>
    </section>
  );
}

function mutationFailed(mutations: ReturnType<typeof useAnnouncementMutations>): boolean {
  return Object.values(mutations).some((mutation) => mutation.isError);
}
