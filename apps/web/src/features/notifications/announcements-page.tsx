import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createAnnouncementRequestSchema,
  updateAnnouncementRequestSchema,
  type CreateAnnouncementRequest,
  type UpdateAnnouncementRequest,
} from "@web-admin-base/contracts";
import { AlertCircle, Plus, RefreshCw, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { hasPermission } from "@/features/permissions/permission-utils";
import { translate } from "@/i18n/messages";
import type { WebAdminRouteMetadata } from "@/route-metadata";
import { useAuthStore } from "@/stores/auth.store";
import { useLayoutStore } from "@/stores/layout.store";
import {
  createAnnouncement,
  fetchAnnouncements,
  publishAnnouncement,
  unpublishAnnouncement,
  updateAnnouncement,
  type Announcement,
} from "./announcement-api";
import { AnnouncementForm } from "./announcement-form";
import { AnnouncementSidePanel } from "./announcement-status";
import { AnnouncementTable } from "./announcement-table";

type AnnouncementsPageProps = {
  route: WebAdminRouteMetadata;
};

export function AnnouncementsPage({ route }: AnnouncementsPageProps) {
  const language = useLayoutStore((state) => state.language);
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const canView = hasPermission(permissionCodes, route.requiredPermission);
  const canCreate = hasPermission(permissionCodes, "announcement:create");
  const canUpdate = hasPermission(permissionCodes, "announcement:update");
  const canPublish = hasPermission(permissionCodes, "announcement:publish");
  const [keyword, setKeyword] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const queryClient = useQueryClient();
  const query = useQuery({
    enabled: canView,
    queryKey: ["announcements"],
    queryFn: fetchAnnouncements,
  });
  const invalidateAnnouncements = async () => {
    await queryClient.invalidateQueries({ queryKey: ["announcements"] });
  };
  const createMutation = useMutation({
    mutationFn: createAnnouncement,
    onSuccess: async () => {
      setCreating(false);
      await invalidateAnnouncements();
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateAnnouncementRequest }) =>
      updateAnnouncement(id, input),
    onSuccess: async () => {
      setEditing(null);
      await invalidateAnnouncements();
    },
  });
  const publishMutation = useMutation({
    mutationFn: publishAnnouncement,
    onSuccess: invalidateAnnouncements,
  });
  const unpublishMutation = useMutation({
    mutationFn: unpublishAnnouncement,
    onSuccess: invalidateAnnouncements,
  });
  const rows = useMemo(
    () =>
      (query.data ?? []).filter((record) =>
        [record.title, record.content, record.scopeType, record.status]
          .join(" ")
          .toLowerCase()
          .includes(keyword.toLowerCase()),
      ),
    [keyword, query.data],
  );

  if (!canView) {
    return (
      <section className="rounded-lg border bg-card p-8 text-center">
        <AlertCircle className="mx-auto size-8 text-destructive" aria-hidden="true" />
        <h2 className="mt-3 text-base font-semibold">
          {translate(language, "common.permissionDenied")}
        </h2>
      </section>
    );
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="space-y-4">
        <AnnouncementsToolbar
          canCreate={canCreate}
          language={language}
          onCreate={() => setCreating(true)}
          onRefresh={() => void query.refetch()}
          route={route}
        />
        <div className="rounded-lg border bg-card shadow-sm">
          <AnnouncementsFilter keyword={keyword} language={language} onChange={setKeyword} />
          <AnnouncementTable
            canPublish={canPublish}
            canUpdate={canUpdate}
            isError={query.isError}
            isLoading={query.isLoading}
            onEdit={setEditing}
            onPublish={(record) => publishMutation.mutate(record.id)}
            onUnpublish={(record) => unpublishMutation.mutate(record.id)}
            rows={rows}
          />
        </div>
      </div>
      <AnnouncementEditorPanel
        creating={creating}
        createPending={createMutation.isPending}
        editing={editing}
        error={
          createMutation.isError ||
          updateMutation.isError ||
          publishMutation.isError ||
          unpublishMutation.isError
        }
        onCancelCreate={() => setCreating(false)}
        onCancelEdit={() => setEditing(null)}
        onCreate={(input) => createMutation.mutate(createAnnouncementRequestSchema.parse(input))}
        onUpdate={(id, input) =>
          updateMutation.mutate({
            id,
            input: updateAnnouncementRequestSchema.parse(input),
          })
        }
        updatePending={updateMutation.isPending}
      />
    </section>
  );
}

function AnnouncementsToolbar({
  canCreate,
  language,
  onCreate,
  onRefresh,
  route,
}: {
  canCreate: boolean;
  language: "en" | "zh";
  onCreate: () => void;
  onRefresh: () => void;
  route: WebAdminRouteMetadata;
}) {
  return (
    <div className="flex items-end justify-between gap-4 rounded-lg border bg-card p-4 shadow-sm">
      <div>
        <h2 className="text-base font-semibold">{translate(language, route.titleI18nKey)}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage announcement drafts and publication state without triggering notification delivery.
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={onRefresh} size="sm" variant="outline">
          <RefreshCw className="size-4" aria-hidden="true" />
          {translate(language, "actions.refresh")}
        </Button>
        {canCreate ? (
          <Button onClick={onCreate} size="sm">
            <Plus className="size-4" aria-hidden="true" />
            {translate(language, "actions.create")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function AnnouncementsFilter({
  keyword,
  language,
  onChange,
}: {
  keyword: string;
  language: "en" | "zh";
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 border-b p-4">
      <label className="flex min-w-80 items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
        <SlidersHorizontal className="size-4 text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">{translate(language, "actions.filter")}</span>
        <input
          className="w-full bg-transparent outline-none"
          onChange={(event) => onChange(event.target.value)}
          placeholder={translate(language, "actions.filter")}
          value={keyword}
        />
      </label>
      <Button onClick={() => onChange("")} size="sm" variant="ghost">
        {translate(language, "actions.reset")}
      </Button>
    </div>
  );
}

function AnnouncementEditorPanel({
  creating,
  createPending,
  editing,
  error,
  onCancelCreate,
  onCancelEdit,
  onCreate,
  onUpdate,
  updatePending,
}: {
  creating: boolean;
  createPending: boolean;
  editing: Announcement | null;
  error: boolean;
  onCancelCreate: () => void;
  onCancelEdit: () => void;
  onCreate: (input: CreateAnnouncementRequest | UpdateAnnouncementRequest) => void;
  onUpdate: (id: string, input: CreateAnnouncementRequest | UpdateAnnouncementRequest) => void;
  updatePending: boolean;
}) {
  return (
    <aside className="space-y-4">
      {creating ? (
        <AnnouncementForm
          busy={createPending}
          mode="create"
          onCancel={onCancelCreate}
          onSubmit={onCreate}
        />
      ) : null}
      {editing ? (
        <AnnouncementForm
          busy={updatePending}
          initialRecord={editing}
          key={editing.id}
          mode="edit"
          onCancel={onCancelEdit}
          onSubmit={(input) => onUpdate(editing.id, input)}
        />
      ) : null}
      {!creating && !editing ? <AnnouncementSidePanel /> : null}
      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          The data could not be loaded.
        </div>
      ) : null}
    </aside>
  );
}
