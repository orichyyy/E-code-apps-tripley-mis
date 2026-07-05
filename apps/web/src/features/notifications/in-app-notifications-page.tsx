import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, RefreshCw, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { hasPermission } from "@/features/permissions/permission-utils";
import { translate } from "@/i18n/messages";
import type { WebAdminRouteMetadata } from "@/route-metadata";
import { useAuthStore } from "@/stores/auth.store";
import { useLayoutStore } from "@/stores/layout.store";
import {
  archiveNotification,
  deleteNotification,
  fetchInAppNotifications,
  markNotificationRead,
} from "./in-app-notification-api";
import { InAppNotificationSidePanel } from "./in-app-notification-status";
import { InAppNotificationTable } from "./in-app-notification-table";

type InAppNotificationsPageProps = {
  route: WebAdminRouteMetadata;
};

export function InAppNotificationsPage({ route }: InAppNotificationsPageProps) {
  const language = useLayoutStore((state) => state.language);
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const canView = hasPermission(permissionCodes, route.requiredPermission);
  const canUpdate = hasPermission(permissionCodes, "notification:update");
  const [keyword, setKeyword] = useState("");
  const queryClient = useQueryClient();
  const query = useQuery({
    enabled: canView,
    queryKey: ["in-app-notifications"],
    queryFn: fetchInAppNotifications,
  });
  const invalidateNotifications = async () => {
    await queryClient.invalidateQueries({ queryKey: ["in-app-notifications"] });
  };
  const readMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: invalidateNotifications,
  });
  const archiveMutation = useMutation({
    mutationFn: archiveNotification,
    onSuccess: invalidateNotifications,
  });
  const deleteMutation = useMutation({
    mutationFn: deleteNotification,
    onSuccess: invalidateNotifications,
  });
  const rows = useMemo(
    () =>
      (query.data ?? []).filter((record) =>
        [record.title, record.body, record.status, record.channel, JSON.stringify(record.metadata)]
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
        <InAppNotificationsToolbar
          language={language}
          onRefresh={() => void query.refetch()}
          unreadCount={(query.data ?? []).filter((record) => record.status === "unread").length}
          route={route}
        />
        <div className="rounded-lg border bg-card shadow-sm">
          <InAppNotificationsFilter keyword={keyword} language={language} onChange={setKeyword} />
          <InAppNotificationTable
            canUpdate={canUpdate}
            isError={
              query.isError ||
              readMutation.isError ||
              archiveMutation.isError ||
              deleteMutation.isError
            }
            isLoading={query.isLoading}
            onArchive={(record) => archiveMutation.mutate(record.id)}
            onDelete={(record) => deleteMutation.mutate(record.id)}
            onRead={(record) => readMutation.mutate(record.id)}
            rows={rows}
          />
        </div>
      </div>
      <InAppNotificationSidePanel />
    </section>
  );
}

function InAppNotificationsToolbar({
  language,
  onRefresh,
  route,
  unreadCount,
}: {
  language: "en" | "zh";
  onRefresh: () => void;
  route: WebAdminRouteMetadata;
  unreadCount: number;
}) {
  return (
    <div className="flex items-end justify-between gap-4 rounded-lg border bg-card p-4 shadow-sm">
      <div>
        <h2 className="text-base font-semibold">{translate(language, route.titleI18nKey)}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review current-user in-app notifications and update their read/archive/delete state.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">{unreadCount} unread</span>
        <Button onClick={onRefresh} size="sm" variant="outline">
          <RefreshCw className="size-4" aria-hidden="true" />
          {translate(language, "actions.refresh")}
        </Button>
      </div>
    </div>
  );
}

function InAppNotificationsFilter({
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
