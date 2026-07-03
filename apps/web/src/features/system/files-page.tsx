import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, RefreshCw, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { hasPermission } from "@/features/permissions/permission-utils";
import { translate } from "@/i18n/messages";
import type { WebAdminRouteMetadata } from "@/route-metadata";
import { useAuthStore } from "@/stores/auth.store";
import { useLayoutStore } from "@/stores/layout.store";
import { deleteFile, fetchFileDetail, fetchFiles } from "./file-api";
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
  const [keyword, setKeyword] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
  const deleteMutation = useMutation({
    mutationFn: deleteFile,
    onSuccess: async (_result, id) => {
      await queryClient.invalidateQueries({ queryKey: ["files"] });
      await queryClient.invalidateQueries({ queryKey: ["files", id] });
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
          language={language}
          onRefresh={() => void listQuery.refetch()}
          route={route}
          totalCount={listQuery.data?.length ?? 0}
        />
        <div className="rounded-lg border bg-card shadow-sm">
          <FilesFilter keyword={keyword} language={language} onChange={setKeyword} />
          <FileTable
            canDelete={canDelete}
            isError={listQuery.isError || detailQuery.isError || deleteMutation.isError}
            isLoading={listQuery.isLoading}
            onDelete={(record) => deleteMutation.mutate(record.id)}
            onDetail={(record) => setSelectedId(record.id)}
            rows={rows}
          />
        </div>
      </div>
      <FileDetailPanel record={selectedRecord} />
    </section>
  );
}

function FilesToolbar({
  language,
  onRefresh,
  route,
  totalCount
}: {
  language: "en" | "zh";
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
