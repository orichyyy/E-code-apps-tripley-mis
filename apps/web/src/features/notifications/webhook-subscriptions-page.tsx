import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createWebhookSubscriptionRequestSchema,
  updateWebhookSubscriptionRequestSchema,
  type UpdateWebhookSubscriptionRequest,
} from "@web-admin-base/contracts";
import { AlertCircle, Plus, RefreshCw, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  createWebhookSubscription,
  deleteWebhookSubscription,
  fetchWebhookEventTypes,
  fetchWebhookSubscriptions,
  updateWebhookSubscription,
  type WebhookSubscription,
} from "@/features/notifications/webhook-subscription-api";
import { hasPermission } from "@/features/permissions/permission-utils";
import { translate } from "@/i18n/messages";
import type { WebAdminRouteMetadata } from "@/route-metadata";
import { useAuthStore } from "@/stores/auth.store";
import { useLayoutStore } from "@/stores/layout.store";
import { WebhookSubscriptionForm } from "./webhook-subscription-form";
import { WebhookSubscriptionTable } from "./webhook-subscription-table";
import { WebhookSidePanel } from "./webhook-status";

type WebhookSubscriptionsPageProps = {
  route: WebAdminRouteMetadata;
};

export function WebhookSubscriptionsPanel({ route }: WebhookSubscriptionsPageProps) {
  const language = useLayoutStore((state) => state.language);
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const canView = hasPermission(permissionCodes, route.requiredPermission);
  const canCreate = hasPermission(permissionCodes, "webhook:create");
  const canUpdate = hasPermission(permissionCodes, "webhook:update");
  const canDelete = hasPermission(permissionCodes, "webhook:delete");
  const [keyword, setKeyword] = useState("");
  const [editing, setEditing] = useState<WebhookSubscription | null>(null);
  const [creating, setCreating] = useState(false);
  const queryClient = useQueryClient();
  const query = useQuery({
    enabled: canView,
    queryKey: ["webhook-subscriptions"],
    queryFn: fetchWebhookSubscriptions,
  });
  const eventCatalogQuery = useQuery({
    enabled: canView,
    queryKey: ["webhook-event-types"],
    queryFn: fetchWebhookEventTypes,
  });
  const createMutation = useMutation({
    mutationFn: createWebhookSubscription,
    onSuccess: async () => {
      setCreating(false);
      await queryClient.invalidateQueries({ queryKey: ["webhook-subscriptions"] });
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateWebhookSubscriptionRequest }) =>
      updateWebhookSubscription(id, input),
    onSuccess: async () => {
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["webhook-subscriptions"] });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: deleteWebhookSubscription,
    onSuccess: async () => {
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["webhook-subscriptions"] });
    },
  });
  const rows = useMemo(
    () =>
      (query.data ?? []).filter((record) =>
        [record.name, record.url, record.status, record.eventTypes.join(",")]
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
        <WebhookToolbar
          canCreate={canCreate}
          language={language}
          onCreate={() => setCreating(true)}
          onRefresh={() => void query.refetch()}
          route={route}
        />
        <div className="rounded-lg border bg-card shadow-sm">
          <WebhookFilter keyword={keyword} language={language} onChange={setKeyword} />
          <WebhookSubscriptionTable
            busy={updateMutation.isPending || deleteMutation.isPending}
            canDelete={canDelete}
            canUpdate={canUpdate}
            isError={query.isError}
            isLoading={query.isLoading}
            onEdit={setEditing}
            onDelete={(record) => {
              if (window.confirm(`Delete webhook subscription “${record.name}”?`)) {
                deleteMutation.mutate(record.id);
              }
            }}
            onToggle={(record) =>
              updateMutation.mutate({
                id: record.id,
                input: { status: record.status === "enabled" ? "disabled" : "enabled" },
              })
            }
            rows={rows}
          />
        </div>
      </div>
      <WebhookEditorPanel
        creating={creating}
        createPending={createMutation.isPending}
        editing={editing}
        error={createMutation.isError || updateMutation.isError || eventCatalogQuery.isError}
        eventCatalog={eventCatalogQuery.data ?? []}
        onCancelCreate={() => setCreating(false)}
        onCancelEdit={() => setEditing(null)}
        onCreate={(input) =>
          createMutation.mutate(createWebhookSubscriptionRequestSchema.parse(input))
        }
        onUpdate={(id, input) =>
          updateMutation.mutate({
            id,
            input: updateWebhookSubscriptionRequestSchema.parse(input),
          })
        }
        updatePending={updateMutation.isPending}
      />
    </section>
  );
}

function WebhookToolbar({
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
          Manage durable subscriptions and encrypted request-signing secrets.
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

function WebhookFilter({
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

function WebhookEditorPanel({
  creating,
  createPending,
  editing,
  eventCatalog,
  error,
  onCancelCreate,
  onCancelEdit,
  onCreate,
  onUpdate,
  updatePending,
}: {
  creating: boolean;
  createPending: boolean;
  editing: WebhookSubscription | null;
  eventCatalog: Parameters<typeof WebhookSubscriptionForm>[0]["eventCatalog"];
  error: boolean;
  onCancelCreate: () => void;
  onCancelEdit: () => void;
  onCreate: Parameters<typeof WebhookSubscriptionForm>[0]["onSubmit"];
  onUpdate: (
    id: string,
    input: Parameters<typeof WebhookSubscriptionForm>[0]["onSubmit"] extends (
      input: infer T,
    ) => void
      ? T
      : never,
  ) => void;
  updatePending: boolean;
}) {
  return (
    <aside className="space-y-4">
      {creating ? (
        <WebhookSubscriptionForm
          busy={createPending}
          eventCatalog={eventCatalog}
          mode="create"
          onCancel={onCancelCreate}
          onSubmit={onCreate}
        />
      ) : null}
      {editing ? (
        <WebhookSubscriptionForm
          busy={updatePending}
          eventCatalog={eventCatalog}
          initialRecord={editing}
          key={editing.id}
          mode="edit"
          onCancel={onCancelEdit}
          onSubmit={(input) => onUpdate(editing.id, input)}
        />
      ) : null}
      {!creating && !editing ? <WebhookSidePanel /> : null}
      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          The data could not be loaded.
        </div>
      ) : null}
    </aside>
  );
}
