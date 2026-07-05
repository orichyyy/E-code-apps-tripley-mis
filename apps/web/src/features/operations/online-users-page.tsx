import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Loader2, RefreshCw, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { hasPermission } from "@/features/permissions/permission-utils";
import { translate } from "@/i18n/messages";
import type { WebAdminRouteMetadata } from "@/route-metadata";
import { useAuthStore } from "@/stores/auth.store";
import { useLayoutStore } from "@/stores/layout.store";
import { fetchOnlineUsers, type OnlineUser } from "./operations-api";
import { EmptyState, ErrorState, StatusBadge } from "./status-badge";

export function OnlineUsersPage({ route }: { route: WebAdminRouteMetadata }) {
  const language = useLayoutStore((state) => state.language);
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const canView = hasPermission(permissionCodes, route.requiredPermission);
  const [keyword, setKeyword] = useState("");
  const query = useQuery({
    enabled: canView,
    queryKey: ["online-users"],
    queryFn: fetchOnlineUsers,
  });
  const rows = useMemo(
    () =>
      (query.data ?? []).filter((record) =>
        [
          record.username,
          record.displayName,
          record.organizationName,
          record.ipAddress ?? "",
          record.userAgent ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(keyword.toLowerCase()),
      ),
    [keyword, query.data],
  );

  if (!canView) return <PermissionDenied language={language} />;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4 rounded-lg border bg-card p-4 shadow-sm">
        <div>
          <h2 className="text-base font-semibold">{translate(language, route.titleI18nKey)}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            View active login sessions. Version 1 does not implement online user kick-out.
          </p>
        </div>
        <Button onClick={() => void query.refetch()} size="sm" variant="outline">
          <RefreshCw className="size-4" aria-hidden="true" />
          {translate(language, "actions.refresh")}
        </Button>
      </div>
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="flex items-center gap-3 border-b p-4">
          <label className="flex min-w-80 items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
            <Search className="size-4 text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">{translate(language, "actions.filter")}</span>
            <input
              className="w-full bg-transparent outline-none"
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Filter users, organizations, IP, or user agent"
              value={keyword}
            />
          </label>
          <Button onClick={() => setKeyword("")} size="sm" variant="ghost">
            {translate(language, "actions.reset")}
          </Button>
        </div>
        <OnlineUsersTable isError={query.isError} isLoading={query.isLoading} rows={rows} />
      </div>
    </section>
  );
}

function OnlineUsersTable({
  isError,
  isLoading,
  rows,
}: {
  isError: boolean;
  isLoading: boolean;
  rows: OnlineUser[];
}) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Loading data
      </div>
    );
  }
  if (isError) return <ErrorState text="The data could not be loaded." />;
  if (rows.length === 0) return <EmptyState text="No records match the current filters." />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="border-b px-4 py-3 font-medium">User</th>
            <th className="border-b px-4 py-3 font-medium">Organization</th>
            <th className="border-b px-4 py-3 font-medium">Network</th>
            <th className="border-b px-4 py-3 font-medium">Session</th>
            <th className="border-b px-4 py-3 font-medium">Last seen</th>
            <th className="border-b px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((record) => (
            <tr className="hover:bg-muted/40" key={record.id}>
              <td className="border-b px-4 py-3">
                <div className="font-medium">{record.displayName || record.username}</div>
                <div className="text-xs text-muted-foreground">
                  {record.username || record.userId}
                </div>
              </td>
              <td className="border-b px-4 py-3">
                <div>{record.organizationName || "-"}</div>
                <div className="text-xs text-muted-foreground">
                  ID {record.currentOrganizationId || record.organizationId || "-"}
                </div>
              </td>
              <td className="max-w-80 border-b px-4 py-3">
                <div>{record.ipAddress ?? "-"}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {record.userAgent ?? "-"}
                </div>
              </td>
              <td className="border-b px-4 py-3 text-muted-foreground">
                <div>{record.createdAt || "-"}</div>
                <div className="text-xs">Expires {record.expiresAt || "-"}</div>
              </td>
              <td className="border-b px-4 py-3 text-muted-foreground">
                {record.lastSeenAt || "-"}
              </td>
              <td className="border-b px-4 py-3">
                <StatusBadge>{record.status}</StatusBadge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
