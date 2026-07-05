import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createExportTaskRequestSchema } from "@web-admin-base/contracts";
import { AlertCircle, Plus, RefreshCw, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { hasPermission } from "@/features/permissions/permission-utils";
import { translate } from "@/i18n/messages";
import type { WebAdminRouteMetadata } from "@/route-metadata";
import { useAuthStore } from "@/stores/auth.store";
import { useLayoutStore } from "@/stores/layout.store";
import { ImportExportDetail } from "./import-export-detail";
import { ExportTaskForm } from "./import-export-form";
import { ImportExportTable } from "./import-export-table";
import { createExportTask, fetchImportExportTask, fetchImportExportTasks } from "./operations-api";

export function ImportExportPage({ route }: { route: WebAdminRouteMetadata }) {
  const language = useLayoutStore((state) => state.language);
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const canView = hasPermission(permissionCodes, route.requiredPermission);
  const canCreate = hasPermission(permissionCodes, "import-export:create");
  const [keyword, setKeyword] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const queryClient = useQueryClient();
  const query = useQuery({
    enabled: canView,
    queryKey: ["import-export-tasks"],
    queryFn: fetchImportExportTasks,
  });
  const detailQuery = useQuery({
    enabled: canView && selectedId !== null,
    queryKey: ["import-export-task", selectedId],
    queryFn: () => fetchImportExportTask(String(selectedId)),
  });
  const createMutation = useMutation({
    mutationFn: createExportTask,
    onSuccess: async (envelope) => {
      setCreating(false);
      setSelectedId(envelope.data.id);
      await queryClient.invalidateQueries({ queryKey: ["import-export-tasks"] });
    },
  });
  const rows = useMemo(
    () =>
      (query.data ?? []).filter((record) =>
        [record.taskType, record.resourceType, record.status, record.createdBy ?? ""]
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
              CSV export tasks are asynchronous. Result files are retained by the backend policy.
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
                New export
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
                placeholder="Filter resource, task type, status, or creator"
                value={keyword}
              />
            </label>
            <Button onClick={() => setKeyword("")} size="sm" variant="ghost">
              {translate(language, "actions.reset")}
            </Button>
          </div>
          <ImportExportTable
            isError={query.isError}
            isLoading={query.isLoading}
            onSelect={setSelectedId}
            rows={rows}
            selectedId={selectedId}
          />
        </div>
      </div>
      <aside className="flex flex-col gap-4">
        {creating ? (
          <ExportTaskForm
            busy={createMutation.isPending}
            onCancel={() => setCreating(false)}
            onSubmit={(resourceType) =>
              createMutation.mutate(createExportTaskRequestSchema.parse({ resourceType }))
            }
          />
        ) : (
          <ImportExportDetail isLoading={detailQuery.isLoading} task={detailQuery.data ?? null} />
        )}
        {createMutation.isError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            Export task creation failed.
          </div>
        ) : null}
      </aside>
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
