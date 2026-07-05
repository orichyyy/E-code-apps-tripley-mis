import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateDictionaryItemRequest,
  CreateDictionaryTypeRequest,
} from "@web-admin-base/contracts";
import { AlertCircle, Plus, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { hasPermission } from "@/features/permissions/permission-utils";
import { translate } from "@/i18n/messages";
import type { WebAdminRouteMetadata } from "@/route-metadata";
import { useAuthStore } from "@/stores/auth.store";
import { useLayoutStore } from "@/stores/layout.store";
import { DictionaryEditorPanel } from "./dictionary-editor-panel";
import { DictionaryItemsPanel } from "./dictionary-items-panel";
import { DictionaryTypeList } from "./dictionary-type-list";
import {
  createDictionaryItem,
  createDictionaryType,
  fetchDictionaryItems,
  fetchDictionaryTypes,
  updateDictionaryItem,
  updateDictionaryType,
  type DictionaryItem,
  type DictionaryType,
} from "./system-management-api";

type EditorState =
  | { kind: "type-create" }
  | { kind: "type-edit"; record: DictionaryType }
  | { kind: "item-create" }
  | { kind: "item-edit"; record: DictionaryItem }
  | null;

export function DictionaryPage({ route }: { route: WebAdminRouteMetadata }) {
  const language = useLayoutStore((state) => state.language);
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const canView = hasPermission(permissionCodes, route.requiredPermission);
  const canCreate = hasPermission(permissionCodes, "dictionary:create");
  const canUpdate = hasPermission(permissionCodes, "dictionary:update");
  const [keyword, setKeyword] = useState("");
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);
  const queryClient = useQueryClient();
  const typesQuery = useQuery({
    enabled: canView,
    queryKey: ["dictionary-types"],
    queryFn: fetchDictionaryTypes,
  });
  const selectedType = (typesQuery.data ?? []).find((type) => type.id === selectedTypeId) ?? null;
  const itemsQuery = useQuery({
    enabled: canView && selectedTypeId !== null,
    queryKey: ["dictionary-items", selectedTypeId],
    queryFn: () => fetchDictionaryItems(String(selectedTypeId)),
  });

  useEffect(() => {
    if (!selectedTypeId && typesQuery.data?.[0]) setSelectedTypeId(typesQuery.data[0].id);
  }, [selectedTypeId, typesQuery.data]);

  const invalidateTypes = async () => {
    await queryClient.invalidateQueries({ queryKey: ["dictionary-types"] });
  };
  const invalidateItems = async () => {
    await queryClient.invalidateQueries({ queryKey: ["dictionary-items", selectedTypeId] });
  };
  const createTypeMutation = useMutation({
    mutationFn: createDictionaryType,
    onSuccess: async (result) => {
      setSelectedTypeId(result.data.id);
      setEditor(null);
      await invalidateTypes();
    },
  });
  const updateTypeMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CreateDictionaryTypeRequest> }) =>
      updateDictionaryType(id, input),
    onSuccess: async () => {
      setEditor(null);
      await invalidateTypes();
    },
  });
  const createItemMutation = useMutation({
    mutationFn: ({ typeId, input }: { typeId: string; input: CreateDictionaryItemRequest }) =>
      createDictionaryItem(typeId, input),
    onSuccess: async () => {
      setEditor(null);
      await invalidateItems();
    },
  });
  const updateItemMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CreateDictionaryItemRequest> }) =>
      updateDictionaryItem(id, input),
    onSuccess: async () => {
      setEditor(null);
      await invalidateItems();
    },
  });

  const filteredTypes = useMemo(
    () =>
      (typesQuery.data ?? []).filter((record) =>
        [record.code, record.name, record.description ?? "", record.status]
          .join(" ")
          .toLowerCase()
          .includes(keyword.toLowerCase()),
      ),
    [keyword, typesQuery.data],
  );

  if (!canView) return <PermissionDenied language={language} />;

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(20rem,0.95fr)_minmax(0,1.45fr)_24rem]">
      <div className="flex flex-col gap-4">
        <DictionaryHeader
          canCreate={canCreate}
          onCreate={() => setEditor({ kind: "type-create" })}
          onRefresh={() => void typesQuery.refetch()}
          route={route}
          language={language}
        />
        <DictionaryTypeList
          canUpdate={canUpdate}
          isError={typesQuery.isError}
          isLoading={typesQuery.isLoading}
          keyword={keyword}
          onEdit={(record) => setEditor({ kind: "type-edit", record })}
          onKeywordChange={setKeyword}
          onSelect={(record) => setSelectedTypeId(record.id)}
          onStatus={(record, status) =>
            updateTypeMutation.mutate({ id: record.id, input: { status } })
          }
          rows={filteredTypes}
          selectedId={selectedTypeId}
        />
      </div>
      <DictionaryItemsPanel
        canCreate={canCreate}
        canUpdate={canUpdate}
        isError={itemsQuery.isError}
        isLoading={itemsQuery.isLoading}
        onCreate={() => setEditor({ kind: "item-create" })}
        onEdit={(record) => setEditor({ kind: "item-edit", record })}
        onRefresh={() => void itemsQuery.refetch()}
        onStatus={(record, status) =>
          updateItemMutation.mutate({ id: record.id, input: { status } })
        }
        rows={itemsQuery.data ?? []}
        selectedType={selectedType}
      />
      <DictionaryEditorPanel
        busy={
          createTypeMutation.isPending ||
          updateTypeMutation.isPending ||
          createItemMutation.isPending ||
          updateItemMutation.isPending
        }
        editor={editor}
        error={
          createTypeMutation.isError ||
          updateTypeMutation.isError ||
          createItemMutation.isError ||
          updateItemMutation.isError
        }
        onCancel={() => setEditor(null)}
        onCreateItem={(input) => {
          if (selectedTypeId) createItemMutation.mutate({ typeId: selectedTypeId, input });
        }}
        onCreateType={(input) => createTypeMutation.mutate(input)}
        onUpdateItem={(record, input) => updateItemMutation.mutate({ id: record.id, input })}
        onUpdateType={(record, input) => updateTypeMutation.mutate({ id: record.id, input })}
        selectedType={selectedType}
      />
    </section>
  );
}

function DictionaryHeader({
  canCreate,
  language,
  onCreate,
  onRefresh,
  route,
}: {
  canCreate: boolean;
  language: "en" | "zh";
  onCreate: () => void;
  onRefresh: () => void;
  route: WebAdminRouteMetadata;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">{translate(language, route.titleI18nKey)}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage global dictionary types and i18n-backed items.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={onRefresh} size="sm" variant="outline">
            <RefreshCw className="size-4" aria-hidden="true" />
            Refresh
          </Button>
          {canCreate ? (
            <Button onClick={onCreate} size="sm">
              <Plus className="size-4" aria-hidden="true" />
              Type
            </Button>
          ) : null}
        </div>
      </div>
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
