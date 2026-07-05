import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createScheduledTaskRequestSchema,
  updateScheduledTaskRequestSchema,
  type CreateScheduledTaskRequest,
} from "@web-admin-base/contracts";
import { AlertCircle, Loader2, Play, Plus, RefreshCw, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { hasPermission } from "@/features/permissions/permission-utils";
import { translate } from "@/i18n/messages";
import type { WebAdminRouteMetadata } from "@/route-metadata";
import { useAuthStore } from "@/stores/auth.store";
import { useLayoutStore } from "@/stores/layout.store";
import {
  createScheduledTask,
  fetchScheduledTasks,
  runScheduledTask,
  setScheduledTaskStatus,
  updateScheduledTask,
  type ScheduledTask,
} from "./operations-api";
import { SchedulerForm } from "./scheduler-form";
import { EmptyState, ErrorState, StatusBadge } from "./status-badge";

export function SchedulerPage({ route }: { route: WebAdminRouteMetadata }) {
  const language = useLayoutStore((state) => state.language);
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const canView = hasPermission(permissionCodes, route.requiredPermission);
  const canCreate = hasPermission(permissionCodes, "job:create");
  const canUpdate = hasPermission(permissionCodes, "job:update");
  const canRun = hasPermission(permissionCodes, "job:run");
  const [keyword, setKeyword] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ScheduledTask | null>(null);
  const queryClient = useQueryClient();
  const query = useQuery({
    enabled: canView,
    queryKey: ["scheduled-tasks"],
    queryFn: fetchScheduledTasks,
  });
  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["scheduled-tasks"] });
  };
  const createMutation = useMutation({
    mutationFn: createScheduledTask,
    onSuccess: async () => {
      setCreating(false);
      await invalidate();
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: CreateScheduledTaskRequest }) =>
      updateScheduledTask(id, updateScheduledTaskRequestSchema.parse(input)),
    onSuccess: async () => {
      setEditing(null);
      await invalidate();
    },
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      setScheduledTaskStatus(id, enabled),
    onSuccess: invalidate,
  });
  const runMutation = useMutation({
    mutationFn: runScheduledTask,
    onSuccess: invalidate,
  });
  const rows = useMemo(
    () =>
      (query.data ?? []).filter((record) =>
        [
          record.code,
          record.handlerType,
          record.cronExpression,
          record.status,
          record.lastError ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(keyword.toLowerCase()),
      ),
    [keyword, query.data],
  );

  if (!canView) return <PermissionDenied language={language} />;

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-4 rounded-lg border bg-card p-4 shadow-sm">
          <div>
            <h2 className="text-base font-semibold">{translate(language, route.titleI18nKey)}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage base scheduled tasks backed by the configured worker and scheduler adapters.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => void query.refetch()} size="sm" variant="outline">
              <RefreshCw className="size-4" aria-hidden="true" />
              {translate(language, "actions.refresh")}
            </Button>
            {canCreate ? (
              <Button onClick={() => setCreating(true)} size="sm">
                <Plus className="size-4" aria-hidden="true" />
                {translate(language, "actions.create")}
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
                placeholder="Filter code, handler, cron, or status"
                value={keyword}
              />
            </label>
            <Button onClick={() => setKeyword("")} size="sm" variant="ghost">
              {translate(language, "actions.reset")}
            </Button>
          </div>
          <ScheduledTaskTable
            canRun={canRun}
            canUpdate={canUpdate}
            isError={query.isError}
            isLoading={query.isLoading}
            onEdit={setEditing}
            onRun={(record) => runMutation.mutate(record.id)}
            onStatus={(record, enabled) => statusMutation.mutate({ id: record.id, enabled })}
            rows={rows}
          />
        </div>
      </div>
      <aside className="flex flex-col gap-4">
        {creating ? (
          <SchedulerForm
            busy={createMutation.isPending}
            mode="create"
            onCancel={() => setCreating(false)}
            onSubmit={(input) =>
              createMutation.mutate(createScheduledTaskRequestSchema.parse(input))
            }
          />
        ) : null}
        {editing ? (
          <SchedulerForm
            busy={updateMutation.isPending}
            initialRecord={editing}
            key={editing.id}
            mode="edit"
            onCancel={() => setEditing(null)}
            onSubmit={(input) => updateMutation.mutate({ id: editing.id, input })}
          />
        ) : null}
        {!creating && !editing ? <SchedulerHelp /> : null}
        {createMutation.isError ||
        updateMutation.isError ||
        statusMutation.isError ||
        runMutation.isError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            The task mutation failed.
          </div>
        ) : null}
      </aside>
    </section>
  );
}

function ScheduledTaskTable({
  canRun,
  canUpdate,
  isError,
  isLoading,
  onEdit,
  onRun,
  onStatus,
  rows,
}: {
  canRun: boolean;
  canUpdate: boolean;
  isError: boolean;
  isLoading: boolean;
  onEdit: (record: ScheduledTask) => void;
  onRun: (record: ScheduledTask) => void;
  onStatus: (record: ScheduledTask, enabled: boolean) => void;
  rows: ScheduledTask[];
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
            <th className="border-b px-4 py-3 font-medium">Task</th>
            <th className="border-b px-4 py-3 font-medium">Schedule</th>
            <th className="border-b px-4 py-3 font-medium">Attempts</th>
            <th className="border-b px-4 py-3 font-medium">Status</th>
            <th className="border-b px-4 py-3 font-medium">Updated</th>
            <th className="border-b px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((record) => (
            <tr className="hover:bg-muted/40" key={record.id}>
              <td className="border-b px-4 py-3">
                <div className="font-medium">{record.code}</div>
                <div className="text-xs text-muted-foreground">{record.handlerType}</div>
              </td>
              <td className="border-b px-4 py-3">
                <div className="font-mono text-xs">{record.cronExpression}</div>
                <div className="text-xs text-muted-foreground">Next {record.nextRunAt ?? "-"}</div>
              </td>
              <td className="border-b px-4 py-3 text-muted-foreground">
                {record.attempt}/{record.maxAttempts}
              </td>
              <td className="border-b px-4 py-3">
                <StatusBadge>{record.status}</StatusBadge>
              </td>
              <td className="border-b px-4 py-3 text-muted-foreground">
                {record.updatedAt || "-"}
              </td>
              <td className="border-b px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  {canUpdate ? (
                    <Button onClick={() => onEdit(record)} size="sm" variant="outline">
                      Edit
                    </Button>
                  ) : null}
                  {canUpdate ? (
                    <Button
                      onClick={() => onStatus(record, !record.enabled)}
                      size="sm"
                      variant="ghost"
                    >
                      {record.enabled ? "Disable" : "Enable"}
                    </Button>
                  ) : null}
                  {canRun ? (
                    <Button onClick={() => onRun(record)} size="sm" variant="ghost">
                      <Play className="size-4" aria-hidden="true" />
                      Run
                    </Button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SchedulerHelp() {
  return (
    <section className="rounded-lg border bg-card p-4 text-sm shadow-sm">
      <h3 className="font-semibold">Worker execution boundary</h3>
      <p className="mt-2 text-muted-foreground">
        Manual runs enqueue a scheduler job for the worker. Execution details appear in scheduler
        logs after the worker processes the task.
      </p>
    </section>
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
