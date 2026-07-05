import { Loader2 } from "lucide-react";

import type { ImportExportTask } from "./operations-api";
import { StatusBadge } from "./status-badge";

export function ImportExportDetail({
  isLoading,
  task,
}: {
  isLoading: boolean;
  task: ImportExportTask | null;
}) {
  if (isLoading) {
    return (
      <section className="rounded-lg border bg-card p-4 text-sm shadow-sm">
        <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
      </section>
    );
  }
  if (!task) {
    return (
      <section className="rounded-lg border bg-card p-4 text-sm shadow-sm">
        <h3 className="font-semibold">Task detail</h3>
        <p className="mt-2 text-muted-foreground">
          Select a task to inspect result files and validation errors.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border bg-card p-4 text-sm shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{task.resourceType}</h3>
          <p className="mt-1 text-muted-foreground">Task ID {task.id}</p>
        </div>
        <StatusBadge>{task.status}</StatusBadge>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <DetailTerm label="Result file" value={task.resultFileObjectId ?? "-"} />
        <DetailTerm label="Error file" value={task.errorFileObjectId ?? "-"} />
        <DetailTerm label="Success rows" value={String(task.successRows)} />
        <DetailTerm label="Failed rows" value={String(task.failedRows)} />
        <DetailTerm label="Expires" value={task.resultExpiresAt ?? "-"} />
        <DetailTerm label="Updated" value={task.updatedAt || "-"} />
      </dl>
      {task.errorPreview.length > 0 ? (
        <div className="mt-4 rounded-md border bg-muted/30 p-3">
          <div className="font-medium">Error preview</div>
          <pre className="mt-2 max-h-44 overflow-auto text-xs text-muted-foreground">
            {JSON.stringify(task.errorPreview, null, 2)}
          </pre>
        </div>
      ) : null}
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
