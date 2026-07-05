import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UpdateSystemConfigRequest } from "@web-admin-base/contracts";
import { AlertCircle, Loader2, RefreshCw, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { hasPermission } from "@/features/permissions/permission-utils";
import { EmptyState, ErrorState, StatusBadge } from "@/features/operations/status-badge";
import { translate } from "@/i18n/messages";
import type { WebAdminRouteMetadata } from "@/route-metadata";
import { useAuthStore } from "@/stores/auth.store";
import { useLayoutStore } from "@/stores/layout.store";
import { SystemConfigForm } from "./system-config-form";
import { fetchSystemConfigs, updateSystemConfig, type SystemConfig } from "./system-management-api";

export function SystemConfigPage({ route }: { route: WebAdminRouteMetadata }) {
  const language = useLayoutStore((state) => state.language);
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const canView = hasPermission(permissionCodes, route.requiredPermission);
  const canUpdate = hasPermission(permissionCodes, "system-config:update");
  const [keyword, setKeyword] = useState("");
  const [group, setGroup] = useState("all");
  const [editing, setEditing] = useState<SystemConfig | null>(null);
  const queryClient = useQueryClient();
  const query = useQuery({
    enabled: canView,
    queryKey: ["system-configs"],
    queryFn: fetchSystemConfigs,
  });
  const updateMutation = useMutation({
    mutationFn: ({ key, input }: { key: string; input: UpdateSystemConfigRequest }) =>
      updateSystemConfig(key, input),
    onSuccess: async () => {
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["system-configs"] });
    },
  });
  const groups = useMemo(
    () => ["all", ...Array.from(new Set((query.data ?? []).map((item) => item.groupKey)))],
    [query.data],
  );
  const rows = useMemo(
    () =>
      (query.data ?? []).filter((record) => {
        const matchesGroup = group === "all" || record.groupKey === group;
        const text = [
          record.configKey,
          record.groupKey,
          record.description ?? "",
          record.status,
          String(record.configValue),
        ]
          .join(" ")
          .toLowerCase();
        return matchesGroup && text.includes(keyword.toLowerCase());
      }),
    [group, keyword, query.data],
  );

  if (!canView) return <PermissionDenied language={language} />;

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-4 rounded-lg border bg-card p-4 shadow-sm">
          <div>
            <h2 className="text-base font-semibold">{translate(language, route.titleI18nKey)}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage confirmed global configuration values. New configuration keys are introduced by
              backend modules.
            </p>
          </div>
          <Button onClick={() => void query.refetch()} size="sm" variant="outline">
            <RefreshCw className="size-4" aria-hidden="true" />
            {translate(language, "actions.refresh")}
          </Button>
        </div>
        <div className="rounded-lg border bg-card shadow-sm">
          <SystemConfigFilters
            group={group}
            groups={groups}
            keyword={keyword}
            onGroupChange={setGroup}
            onKeywordChange={setKeyword}
            onReset={() => {
              setKeyword("");
              setGroup("all");
            }}
          />
          <SystemConfigTable
            canUpdate={canUpdate}
            isError={query.isError}
            isLoading={query.isLoading}
            onEdit={setEditing}
            rows={rows}
          />
        </div>
      </div>
      <aside className="flex flex-col gap-4">
        {editing ? (
          <SystemConfigForm
            busy={updateMutation.isPending}
            key={editing.configKey}
            onCancel={() => setEditing(null)}
            onSubmit={(input) => updateMutation.mutate({ key: editing.configKey, input })}
            record={editing}
          />
        ) : (
          <section className="rounded-lg border bg-card p-4 text-sm shadow-sm">
            <h3 className="font-semibold">Configuration boundary</h3>
            <p className="mt-2 text-muted-foreground">
              This page only edits existing editable global configuration records.
              Organization-level overrides remain reserved.
            </p>
          </section>
        )}
        {updateMutation.isError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            Configuration update failed.
          </div>
        ) : null}
      </aside>
    </section>
  );
}

function SystemConfigFilters({
  group,
  groups,
  keyword,
  onGroupChange,
  onKeywordChange,
  onReset,
}: {
  group: string;
  groups: string[];
  keyword: string;
  onGroupChange: (value: string) => void;
  onKeywordChange: (value: string) => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b p-4">
      <label className="flex min-w-80 items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
        <Search className="size-4 text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Filter</span>
        <input
          className="w-full bg-transparent outline-none"
          onChange={(event) => onKeywordChange(event.target.value)}
          placeholder="Filter key, group, description, or value"
          value={keyword}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Group</span>
        <select
          className="rounded-md border bg-background px-3 py-2 outline-none"
          onChange={(event) => onGroupChange(event.target.value)}
          value={group}
        >
          {groups.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <Button onClick={onReset} size="sm" variant="ghost">
        Reset
      </Button>
    </div>
  );
}

function SystemConfigTable({
  canUpdate,
  isError,
  isLoading,
  onEdit,
  rows,
}: {
  canUpdate: boolean;
  isError: boolean;
  isLoading: boolean;
  onEdit: (record: SystemConfig) => void;
  rows: SystemConfig[];
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
            <th className="border-b px-4 py-3 font-medium">Key</th>
            <th className="border-b px-4 py-3 font-medium">Value</th>
            <th className="border-b px-4 py-3 font-medium">Type</th>
            <th className="border-b px-4 py-3 font-medium">Status</th>
            <th className="border-b px-4 py-3 font-medium">Updated</th>
            <th className="border-b px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((record) => (
            <tr className="hover:bg-muted/40" key={record.id}>
              <td className="border-b px-4 py-3">
                <div className="font-medium">{record.configKey}</div>
                <div className="text-xs text-muted-foreground">
                  {record.description ?? record.groupKey}
                </div>
              </td>
              <td className="max-w-96 border-b px-4 py-3">
                <span className="block truncate font-mono text-xs">
                  {displayConfigValue(record.configValue)}
                </span>
              </td>
              <td className="border-b px-4 py-3 text-muted-foreground">{record.valueType}</td>
              <td className="border-b px-4 py-3">
                <StatusBadge>{record.status}</StatusBadge>
              </td>
              <td className="border-b px-4 py-3 text-muted-foreground">
                {record.updatedAt || "-"}
              </td>
              <td className="border-b px-4 py-3">
                {canUpdate && record.editable ? (
                  <Button onClick={() => onEdit(record)} size="sm" variant="outline">
                    Edit
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">Read only</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function displayConfigValue(value: SystemConfig["configValue"]): string {
  return typeof value === "object" ? JSON.stringify(value) : String(value);
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
