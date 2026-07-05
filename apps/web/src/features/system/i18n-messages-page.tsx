import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UpdateI18nMessageRequest } from "@web-admin-base/contracts";
import { AlertCircle, RefreshCw, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { hasPermission } from "@/features/permissions/permission-utils";
import { translate } from "@/i18n/messages";
import type { WebAdminRouteMetadata } from "@/route-metadata";
import { useAuthStore } from "@/stores/auth.store";
import { useLayoutStore } from "@/stores/layout.store";
import { fetchI18nMessages, updateI18nMessage, type I18nMessage } from "./i18n-message-api";
import { I18nMessageForm } from "./i18n-message-form";
import { I18nMessageTable } from "./i18n-message-table";

type I18nMessagesPageProps = {
  route: WebAdminRouteMetadata;
};

export function I18nMessagesPage({ route }: I18nMessagesPageProps) {
  const language = useLayoutStore((state) => state.language);
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const canView = hasPermission(permissionCodes, route.requiredPermission);
  const canUpdate = hasPermission(permissionCodes, "i18n:update");
  const [keyword, setKeyword] = useState("");
  const [editing, setEditing] = useState<I18nMessage | null>(null);
  const queryClient = useQueryClient();
  const query = useQuery({
    enabled: canView,
    queryKey: ["i18n-messages"],
    queryFn: fetchI18nMessages,
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateI18nMessageRequest }) =>
      updateI18nMessage(id, input),
    onSuccess: async () => {
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["i18n-messages"] });
    },
  });
  const rows = useMemo(
    () =>
      (query.data ?? []).filter((record) =>
        [record.messageKey, record.language, record.module, record.messageValue]
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
        <I18nMessagesToolbar
          language={language}
          onRefresh={() => void query.refetch()}
          recordCount={query.data?.length ?? 0}
          route={route}
        />
        <div className="rounded-lg border bg-card shadow-sm">
          <I18nMessagesFilter keyword={keyword} language={language} onChange={setKeyword} />
          <I18nMessageTable
            canUpdate={canUpdate}
            isError={query.isError}
            isLoading={query.isLoading}
            onEdit={setEditing}
            rows={rows}
          />
        </div>
      </div>
      <I18nMessagesSidePanel
        editing={editing}
        error={updateMutation.isError}
        onCancelEdit={() => setEditing(null)}
        onUpdate={(id, input) => updateMutation.mutate({ id, input })}
        updatePending={updateMutation.isPending}
      />
    </section>
  );
}

function I18nMessagesToolbar({
  language,
  onRefresh,
  recordCount,
  route,
}: {
  language: "en" | "zh";
  onRefresh: () => void;
  recordCount: number;
  route: WebAdminRouteMetadata;
}) {
  return (
    <div className="flex items-end justify-between gap-4 rounded-lg border bg-card p-4 shadow-sm">
      <div>
        <h2 className="text-base font-semibold">{translate(language, route.titleI18nKey)}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Maintain existing localized message values for frontend UI, backend messages, and
          extension keys.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">{recordCount} records</span>
        <Button onClick={onRefresh} size="sm" variant="outline">
          <RefreshCw className="size-4" aria-hidden="true" />
          {translate(language, "actions.refresh")}
        </Button>
      </div>
    </div>
  );
}

function I18nMessagesFilter({
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
        <Search className="size-4 text-muted-foreground" aria-hidden="true" />
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

function I18nMessagesSidePanel({
  editing,
  error,
  onCancelEdit,
  onUpdate,
  updatePending,
}: {
  editing: I18nMessage | null;
  error: boolean;
  onCancelEdit: () => void;
  onUpdate: (id: string, input: UpdateI18nMessageRequest) => void;
  updatePending: boolean;
}) {
  return (
    <aside className="space-y-4">
      {editing ? (
        <I18nMessageForm
          busy={updatePending}
          initialRecord={editing}
          key={editing.id}
          onCancel={onCancelEdit}
          onSubmit={(input) => onUpdate(editing.id, input)}
        />
      ) : (
        <section className="rounded-lg border bg-card p-4 text-sm shadow-sm">
          <h3 className="font-semibold">Message boundary</h3>
          <p className="mt-2 text-muted-foreground">
            This page edits existing message values only. New i18n keys should be introduced by
            route, menu, dictionary, notification, or module manifests so keys stay stable and
            reviewable.
          </p>
        </section>
      )}
      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          The data could not be saved.
        </div>
      ) : null}
    </aside>
  );
}
