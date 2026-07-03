import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, RefreshCw, Search, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { hasPermission } from "@/features/permissions/permission-utils";
import { translate } from "@/i18n/messages";
import type { WebAdminRouteMetadata } from "@/route-metadata";
import { useAuthStore } from "@/stores/auth.store";
import { useLayoutStore } from "@/stores/layout.store";
import {
  deleteFile,
  downloadFileBlob,
  fetchFileDetail,
  fetchFileReferences,
  fetchFiles,
  previewFileBlob,
  uploadFile,
  type FileRecord
} from "./file-api";
import { FileDetailPanel } from "./file-status";
import { FileTable } from "./file-table";

type FilesPageProps = {
  route: WebAdminRouteMetadata;
};

export function FilesPage({ route }: FilesPageProps) {
  const language = useLayoutStore((state) => state.language);
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const canView = hasPermission(permissionCodes, route.requiredPermission);
  const canDelete = hasPermission(permissionCodes, "file:delete");
  const canDownload = hasPermission(permissionCodes, "file:download");
  const canPreview = hasPermission(permissionCodes, "file:preview");
  const canUpload = hasPermission(permissionCodes, "file:upload");
  const canViewReferences = hasPermission(permissionCodes, "file:references:view");
  const [keyword, setKeyword] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const listQuery = useQuery({
    enabled: canView,
    queryKey: ["files"],
    queryFn: fetchFiles
  });
  const detailQuery = useQuery({
    enabled: canView && selectedId !== null,
    queryKey: ["files", selectedId],
    queryFn: () => fetchFileDetail(selectedId ?? "")
  });
  const referencesQuery = useQuery({
    enabled: canView && canViewReferences && selectedId !== null,
    queryKey: ["files", selectedId, "references"],
    queryFn: () => fetchFileReferences(selectedId ?? "")
  });
  const uploadMutation = useMutation({
    mutationFn: uploadFile,
    onSuccess: async (record) => {
      if (record) setSelectedId(record.id);
      await queryClient.invalidateQueries({ queryKey: ["files"] });
    }
  });
  const deleteMutation = useMutation({
    mutationFn: deleteFile,
    onSuccess: async (_result, id) => {
      await queryClient.invalidateQueries({ queryKey: ["files"] });
      await queryClient.invalidateQueries({ queryKey: ["files", id] });
    }
  });
  const previewMutation = useMutation({
    mutationFn: previewFileBlob,
    onSuccess: (blob) => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    }
  });
  const rows = useMemo(
    () =>
      (listQuery.data ?? []).filter((record) =>
        [
          record.originalName,
          record.objectKey,
          record.contentType,
          record.extension,
          record.storageDriver,
          record.status,
          record.referenced ? "referenced" : "unreferenced"
        ]
          .join(" ")
          .toLowerCase()
          .includes(keyword.toLowerCase())
      ),
    [keyword, listQuery.data]
  );
  const selectedRecord = detailQuery.data ?? listQuery.data?.find((record) => record.id === selectedId) ?? null;

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

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
        <FilesToolbar
          canUpload={canUpload}
          language={language}
          onUpload={(file) => uploadMutation.mutate(file)}
          onRefresh={() => void listQuery.refetch()}
          route={route}
          totalCount={listQuery.data?.length ?? 0}
        />
        <div className="rounded-lg border bg-card shadow-sm">
          <FilesFilter keyword={keyword} language={language} onChange={setKeyword} />
          <FileTable
            canDelete={canDelete}
            canDownload={canDownload}
            canPreview={canPreview}
            isError={
              listQuery.isError ||
              detailQuery.isError ||
              referencesQuery.isError ||
              deleteMutation.isError ||
              uploadMutation.isError ||
              previewMutation.isError
            }
            isLoading={listQuery.isLoading}
            onDelete={(record) => deleteMutation.mutate(record.id)}
            onDetail={(record) => {
              setPreviewUrl(null);
              setSelectedId(record.id);
            }}
            onDownload={(record) => void downloadSelectedFile(record)}
            onPreview={(record) => {
              setSelectedId(record.id);
              previewMutation.mutate(record.id);
            }}
            rows={rows}
          />
        </div>
      </div>
      <FileDetailPanel previewUrl={previewUrl} record={selectedRecord} references={referencesQuery.data ?? []} />
    </section>
  );

  async function downloadSelectedFile(record: FileRecord) {
    const blob = await downloadFileBlob(record.id);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = record.originalName;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}

function FilesToolbar({
  canUpload,
  language,
  onUpload,
  onRefresh,
  route,
  totalCount
}: {
  canUpload: boolean;
  language: "en" | "zh";
  onUpload: (file: File) => void;
  onRefresh: () => void;
  route: WebAdminRouteMetadata;
  totalCount: number;
}) {
  return (
    <div className="flex items-end justify-between gap-4 rounded-lg border bg-card p-4 shadow-sm">
      <div>
        <h2 className="text-base font-semibold">{translate(language, route.titleI18nKey)}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review stored file metadata and invalidate files while preserving referenced business data state.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">{totalCount} files</span>
        <Button onClick={onRefresh} size="sm" variant="outline">
          <RefreshCw className="size-4" aria-hidden="true" />
          {translate(language, "actions.refresh")}
        </Button>
        {canUpload ? (
          <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90">
            <Upload className="size-4" aria-hidden="true" />
            {translate(language, "actions.upload")}
            <input
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onUpload(file);
                event.target.value = "";
              }}
              type="file"
            />
          </label>
        ) : null}
      </div>
    </div>
  );
}

function FilesFilter({
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
