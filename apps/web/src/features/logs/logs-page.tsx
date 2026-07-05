import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Download, Loader2, RefreshCw, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { hasPermission } from "@/features/permissions/permission-utils";
import { translate } from "@/i18n/messages";
import type { WebAdminRouteMetadata } from "@/route-metadata";
import { useAuthStore } from "@/stores/auth.store";
import { useLayoutStore } from "@/stores/layout.store";
import {
  createLogExportTask,
  fetchLogs,
  getLogType,
  type LogEntry,
  type LogRouteCode
} from "./log-api";
import { EmptyState, ErrorState, StatusBadge } from "@/features/operations/status-badge";

export function LogsPage({ route }: { route: WebAdminRouteMetadata & { routeCode: LogRouteCode } }) {
  const language = useLayoutStore((state) => state.language);
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const canView = hasPermission(permissionCodes, route.requiredPermission);
  const canExport = hasPermission(permissionCodes, "log:export");
  const [keyword, setKeyword] = useState("");
  const [selected, setSelected] = useState<LogEntry | null>(null);
  const queryClient = useQueryClient();
  const query = useQuery({
    enabled: canView,
    queryKey: ["logs", route.routeCode],
    queryFn: () => fetchLogs(route.routeCode)
  });
  const exportMutation = useMutation({
    mutationFn: () => createLogExportTask(getLogType(route.routeCode)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["import-export-tasks"] });
    }
  });
  const rows = useMemo(
    () =>
      (query.data ?? []).filter((record) =>
        [
          record.level,
          record.message,
          record.traceId ?? "",
          record.userId ?? "",
          record.ipAddress ?? "",
          JSON.stringify(record.metadata)
        ].join(" ").toLowerCase().includes(keyword.toLowerCase())
      ),
    [keyword, query.data]
  );

  if (!canView) return <PermissionDenied language={language} />;

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-4 rounded-lg border bg-card p-4 shadow-sm">
          <div>
            <h2 className="text-base font-semibold">{translate(language, route.titleI18nKey)}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Logs are written asynchronously. CSV export creates an import/export task.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => void query.refetch()} size="sm" variant="outline">
              <RefreshCw className="size-4" aria-hidden="true" />
              {translate(language, "actions.refresh")}
            </Button>
            {canExport ? (
              <Button disabled={exportMutation.isPending} onClick={() => exportMutation.mutate()} size="sm">
                {exportMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="size-4" aria-hidden="true" />
                )}
                {translate(language, "actions.export")}
              </Button>
            ) : null}
          </div>
        </div>
        <div className="rounded-lg border bg-card shadow-sm">
          <div className="flex items-center gap-3 border-b p-4">
            <label className="flex min-w-80 items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
              <Search className="size-4 text-muted-foreground" aria-hidden="true" />
              <span className="sr-only">{translate(language, "actions.filter")}</span>
              <input
                className="w-full bg-transparent outline-none"
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="Filter message, trace, user, IP, or metadata"
                value={keyword}
              />
            </label>
            <Button onClick={() => setKeyword("")} size="sm" variant="ghost">
              {translate(language, "actions.reset")}
            </Button>
          </div>
          <LogTable
            isError={query.isError}
            isLoading={query.isLoading}
            onSelect={setSelected}
            rows={rows}
            selectedId={selected?.id ?? null}
          />
        </div>
      </div>
      <aside className="flex flex-col gap-4">
        <LogDetailPanel entry={selected} />
        {exportMutation.data ? (
          <div className="rounded-lg border bg-card p-4 text-sm shadow-sm">
            <h3 className="font-semibold">Export task created</h3>
            <p className="mt-2 text-muted-foreground">
              Task {exportMutation.data.id} is available from the import/export task list.
            </p>
          </div>
        ) : null}
        {exportMutation.isError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            Log export task creation failed.
          </div>
        ) : null}
      </aside>
    </section>
  );
}

function LogTable({
  isError,
  isLoading,
  onSelect,
  rows,
  selectedId
}: {
  isError: boolean;
  isLoading: boolean;
  onSelect: (entry: LogEntry) => void;
  rows: LogEntry[];
  selectedId: string | null;
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
            <th className="border-b px-4 py-3 font-medium">Message</th>
            <th className="border-b px-4 py-3 font-medium">Level</th>
            <th className="border-b px-4 py-3 font-medium">Trace</th>
            <th className="border-b px-4 py-3 font-medium">Actor</th>
            <th className="border-b px-4 py-3 font-medium">Occurred</th>
            <th className="border-b px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((record) => (
            <tr className={record.id === selectedId ? "bg-muted/40" : "hover:bg-muted/40"} key={record.id}>
              <td className="max-w-96 border-b px-4 py-3">
                <div className="truncate font-medium">{record.message || "-"}</div>
                <div className="text-xs text-muted-foreground">{record.logType}</div>
              </td>
              <td className="border-b px-4 py-3">
                <StatusBadge>{record.level}</StatusBadge>
              </td>
              <td className="border-b px-4 py-3 text-muted-foreground">{record.traceId ?? "-"}</td>
              <td className="border-b px-4 py-3 text-muted-foreground">
                <div>User {record.userId ?? "-"}</div>
                <div className="text-xs">IP {record.ipAddress ?? "-"}</div>
              </td>
              <td className="border-b px-4 py-3 text-muted-foreground">{record.occurredAt || "-"}</td>
              <td className="border-b px-4 py-3">
                <Button onClick={() => onSelect(record)} size="sm" variant="outline">
                  View
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LogDetailPanel({ entry }: { entry: LogEntry | null }) {
  if (!entry) {
    return (
      <section className="rounded-lg border bg-card p-4 text-sm shadow-sm">
        <h3 className="font-semibold">Log detail</h3>
        <p className="mt-2 text-muted-foreground">Select a log row to inspect trace and metadata fields.</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border bg-card p-4 text-sm shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Log {entry.id}</h3>
          <p className="mt-1 text-muted-foreground">{entry.occurredAt}</p>
        </div>
        <StatusBadge>{entry.level}</StatusBadge>
      </div>
      <p className="mt-4">{entry.message || "-"}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <DetailTerm label="Trace ID" value={entry.traceId ?? "-"} />
        <DetailTerm label="User ID" value={entry.userId ?? "-"} />
        <DetailTerm label="IP address" value={entry.ipAddress ?? "-"} />
        <DetailTerm label="Created" value={entry.createdAt || "-"} />
      </dl>
      <pre className="mt-4 max-h-80 overflow-auto rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
        {JSON.stringify(entry.metadata, null, 2)}
      </pre>
    </section>
  );
}

function DetailTerm({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words font-medium">{value}</dd>
    </div>
  );
}

function PermissionDenied({ language }: { language: "en" | "zh" }) {
  return (
    <section className="rounded-lg border bg-card p-8 text-center">
      <AlertCircle className="mx-auto size-8 text-destructive" aria-hidden="true" />
      <h2 className="mt-3 text-base font-semibold">{translate(language, "common.permissionDenied")}</h2>
    </section>
  );
}
