import { FileText } from "lucide-react";

import type { FileRecord, FileReference } from "./file-api";

export function FileStatusBadge({ isDeleted, status }: { isDeleted: boolean; status: string }) {
  const normalizedStatus = isDeleted ? "invalid" : status;
  const className =
    normalizedStatus === "active"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : "bg-destructive/10 text-destructive";

  return (
    <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${className}`}>
      {normalizedStatus}
    </span>
  );
}

export function ReferencedBadge({ referenced }: { referenced: boolean }) {
  return referenced ? (
    <span className="inline-flex rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
      Referenced
    </span>
  ) : (
    <span className="inline-flex rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
      Unreferenced
    </span>
  );
}

export function FileDetailPanel({
  previewUrl,
  record,
  references,
}: {
  previewUrl: string | null;
  record: FileRecord | null;
  references: FileReference[];
}) {
  return (
    <aside className="rounded-lg border bg-card p-4 text-sm shadow-sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-md bg-primary/10 p-2 text-primary">
          <FileText className="size-4" aria-hidden="true" />
        </div>
        <div>
          <h3 className="font-semibold">{record ? record.originalName : "File metadata"}</h3>
          <p className="mt-2 text-muted-foreground">
            Review stored metadata, preview supported images, and confirm invalidation state for
            referenced data.
          </p>
        </div>
      </div>
      {record ? (
        <>
          {previewUrl ? (
            <div className="mt-4 overflow-hidden rounded-md border bg-muted">
              <img
                alt={record.originalName}
                className="max-h-72 w-full object-contain"
                src={previewUrl}
              />
            </div>
          ) : null}
          <dl className="mt-4 space-y-3">
            <DetailRow label="Object key" value={record.objectKey} />
            <DetailRow label="Storage" value={record.storageDriver} />
            <DetailRow label="Content type" value={record.contentType} />
            <DetailRow label="Extension" value={record.extension || "-"} />
            <DetailRow label="Size" value={formatBytes(record.sizeBytes)} />
            <DetailRow label="Status" value={record.isDeleted ? "invalid" : record.status} />
            <DetailRow label="Referenced" value={record.referenced ? "Yes" : "No"} />
            <DetailRow label="Created" value={record.createdAt} />
            <DetailRow label="Updated" value={record.updatedAt} />
          </dl>
          <FileReferences references={references} />
        </>
      ) : null}
    </aside>
  );
}

export function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const amount = value / 1024 ** exponent;
  const precision = Number.isInteger(amount) || amount >= 10 || exponent === 0 ? 0 : 1;
  return `${amount.toFixed(precision)} ${units[exponent]}`;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words font-medium">{value}</dd>
    </div>
  );
}

function FileReferences({ references }: { references: FileReference[] }) {
  return (
    <div className="mt-5 border-t pt-4">
      <h4 className="text-xs font-semibold uppercase text-muted-foreground">References</h4>
      {references.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          No references are currently recorded for this file.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {references.map((reference) => (
            <div className="rounded-md border bg-background p-3" key={reference.id}>
              <div className="font-medium">{reference.resourceType}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {reference.resourceId} · {reference.referenceType} · {reference.status}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
