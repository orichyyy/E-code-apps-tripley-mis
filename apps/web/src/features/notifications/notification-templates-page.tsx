import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createNotificationTemplateRequestSchema,
  updateNotificationTemplateRequestSchema,
  type CreateNotificationTemplateRequest,
  type UpdateNotificationTemplateRequest
} from "@web-admin-base/contracts";
import { AlertCircle, Plus, RefreshCw, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { hasPermission } from "@/features/permissions/permission-utils";
import { translate } from "@/i18n/messages";
import {
  createNotificationTemplate,
  fetchNotificationTemplates,
  updateNotificationTemplate,
  type NotificationTemplate
} from "./notification-template-api";
import type { WebAdminRouteMetadata } from "@/route-metadata";
import { useAuthStore } from "@/stores/auth.store";
import { useLayoutStore } from "@/stores/layout.store";
import { NotificationTemplateForm } from "./notification-template-form";
import { NotificationTemplateSidePanel } from "./notification-template-status";
import { NotificationTemplateTable } from "./notification-template-table";

type NotificationTemplatesPageProps = {
  route: WebAdminRouteMetadata;
};

export function NotificationTemplatesPage({ route }: NotificationTemplatesPageProps) {
  const language = useLayoutStore((state) => state.language);
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const canView = hasPermission(permissionCodes, route.requiredPermission);
  const canCreate = hasPermission(permissionCodes, "notification-template:create");
  const canUpdate = hasPermission(permissionCodes, "notification-template:update");
  const [keyword, setKeyword] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<NotificationTemplate | null>(null);
  const queryClient = useQueryClient();
  const query = useQuery({
    enabled: canView,
    queryKey: ["notification-templates"],
    queryFn: fetchNotificationTemplates
  });
  const createMutation = useMutation({
    mutationFn: createNotificationTemplate,
    onSuccess: async () => {
      setCreating(false);
      await queryClient.invalidateQueries({ queryKey: ["notification-templates"] });
    }
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateNotificationTemplateRequest }) =>
      updateNotificationTemplate(id, input),
    onSuccess: async () => {
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["notification-templates"] });
    }
  });
  const rows = useMemo(
    () =>
      (query.data ?? []).filter((record) =>
        [record.code, record.channel, record.locale, record.subject ?? "", record.body, record.variables.join(",")]
          .join(" ")
          .toLowerCase()
          .includes(keyword.toLowerCase())
      ),
    [keyword, query.data]
  );

  if (!canView) {
    return (
      <section className="rounded-lg border bg-card p-8 text-center">
        <AlertCircle className="mx-auto size-8 text-destructive" aria-hidden="true" />
        <h2 className="mt-3 text-base font-semibold">{translate(language, "common.permissionDenied")}</h2>
      </section>
    );
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="space-y-4">
        <NotificationTemplateToolbar
          canCreate={canCreate}
          language={language}
          onCreate={() => setCreating(true)}
          onRefresh={() => void query.refetch()}
          route={route}
        />
        <div className="rounded-lg border bg-card shadow-sm">
          <NotificationTemplateFilter keyword={keyword} language={language} onChange={setKeyword} />
          <NotificationTemplateTable
            canUpdate={canUpdate}
            isError={query.isError}
            isLoading={query.isLoading}
            onEdit={setEditing}
            rows={rows}
          />
        </div>
      </div>
      <NotificationTemplateEditorPanel
        creating={creating}
        createPending={createMutation.isPending}
        editing={editing}
        error={createMutation.isError || updateMutation.isError}
        onCancelCreate={() => setCreating(false)}
        onCancelEdit={() => setEditing(null)}
        onCreate={(input) => createMutation.mutate(createNotificationTemplateRequestSchema.parse(input))}
        onUpdate={(id, input) =>
          updateMutation.mutate({
            id,
            input: updateNotificationTemplateRequestSchema.parse(input)
          })
        }
        updatePending={updateMutation.isPending}
      />
    </section>
  );
}

function NotificationTemplateToolbar({
  canCreate,
  language,
  onCreate,
  onRefresh,
  route
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
          Manage persisted notification template records for in-app, email, and reserved SMS channels.
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

function NotificationTemplateFilter({
  keyword,
  language,
  onChange
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

function NotificationTemplateEditorPanel({
  creating,
  createPending,
  editing,
  error,
  onCancelCreate,
  onCancelEdit,
  onCreate,
  onUpdate,
  updatePending
}: {
  creating: boolean;
  createPending: boolean;
  editing: NotificationTemplate | null;
  error: boolean;
  onCancelCreate: () => void;
  onCancelEdit: () => void;
  onCreate: (input: CreateNotificationTemplateRequest | UpdateNotificationTemplateRequest) => void;
  onUpdate: (id: string, input: CreateNotificationTemplateRequest | UpdateNotificationTemplateRequest) => void;
  updatePending: boolean;
}) {
  return (
    <aside className="space-y-4">
      {creating ? (
        <NotificationTemplateForm busy={createPending} mode="create" onCancel={onCancelCreate} onSubmit={onCreate} />
      ) : null}
      {editing ? (
        <NotificationTemplateForm
          busy={updatePending}
          initialRecord={editing}
          key={editing.id}
          mode="edit"
          onCancel={onCancelEdit}
          onSubmit={(input) => onUpdate(editing.id, input)}
        />
      ) : null}
      {!creating && !editing ? <NotificationTemplateSidePanel /> : null}
      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          The data could not be loaded.
        </div>
      ) : null}
    </aside>
  );
}
