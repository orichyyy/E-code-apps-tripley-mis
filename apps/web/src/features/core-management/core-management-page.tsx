import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Plus, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { hasPermission } from "@/features/permissions/permission-utils";
import { translate } from "@/i18n/messages";
import type { WebAdminRouteMetadata } from "@/route-metadata";
import { useAuthStore } from "@/stores/auth.store";
import { useLayoutStore } from "@/stores/layout.store";
import {
  fetchApiPermissions,
  fetchMenus,
  fetchOrganizations,
  fetchPermissions,
  fetchRolePermissions,
  fetchRoles,
  syncPermissions,
  updateMenuApiBindings,
  updateRolePermissions
} from "./core-management-api";
import { CoreAssignmentPanel } from "./core-assignment-panel";
import { CoreEntityForm } from "./core-entity-form";
import { CoreEntityTable } from "./core-entity-table";
import { displayValue, type CoreEntity, type CoreFormValues, type CorePageKind } from "./core-management-model";
import { getPageConfig, runRecordAction } from "./core-page-config";

type CoreManagementPageProps = {
  route: WebAdminRouteMetadata;
  kind: CorePageKind;
};

export function CoreManagementPage({ route, kind }: CoreManagementPageProps) {
  const language = useLayoutStore((state) => state.language);
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const canView = hasPermission(permissionCodes, route.requiredPermission);
  const config = getPageConfig(kind);
  const [keyword, setKeyword] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CoreEntity | null>(null);
  const [selected, setSelected] = useState<CoreEntity | null>(null);
  const queryClient = useQueryClient();
  const query = useQuery({
    enabled: canView,
    queryKey: ["core-management", kind, keyword],
    queryFn: () => config.fetch(keyword)
  });
  const organizationsQuery = useQuery({
    enabled: canView && (kind === "users" || kind === "organizations" || kind === "menus"),
    queryKey: ["core-management", "organizations", "options"],
    queryFn: fetchOrganizations
  });
  const rolesQuery = useQuery({
    enabled: canView && kind === "users",
    queryKey: ["core-management", "roles", "options"],
    queryFn: () => fetchRoles("")
  });
  const permissionsQuery = useQuery({
    enabled: canView && (kind === "roles" || kind === "permissions"),
    queryKey: ["core-management", "permissions", "all"],
    queryFn: () => fetchPermissions("")
  });
  const menusQuery = useQuery({
    enabled: canView && kind === "menus",
    queryKey: ["core-management", "menus", "options"],
    queryFn: fetchMenus
  });
  const apiPermissionsQuery = useQuery({
    enabled: canView && kind === "menus",
    queryKey: ["core-management", "api-permissions", "all"],
    queryFn: fetchApiPermissions
  });
  const rolePermissionsQuery = useQuery({
    enabled: canView && kind === "roles" && Boolean(selected),
    queryKey: ["core-management", "roles", selected?.id, "permissions"],
    queryFn: () => fetchRolePermissions(selected?.id ?? "")
  });
  const fields = useMemo(
    () => config.fields({
      organizations: organizationsQuery.data ?? [],
      roles: rolesQuery.data ?? [],
      menus: menusQuery.data ?? []
    }),
    [config, menusQuery.data, organizationsQuery.data, rolesQuery.data]
  );
  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["core-management"] });
  };
  const createMutation = useMutation({
    mutationFn: (values: CoreFormValues) => config.create?.(values) ?? Promise.resolve(),
    onSuccess: async () => {
      setCreating(false);
      await invalidate();
    }
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: CoreFormValues }) =>
      config.update?.(id, values) ?? Promise.resolve(),
    onSuccess: async () => {
      setEditing(null);
      await invalidate();
    }
  });
  const actionMutation = useMutation({
    mutationFn: ({ record, action }: { record: CoreEntity; action: string }) =>
      runRecordAction(kind, record, action),
    onSuccess: invalidate
  });
  const rolePermissionMutation = useMutation({
    mutationFn: (permissionCodes: string[]) => updateRolePermissions(selected?.id ?? "", permissionCodes),
    onSuccess: invalidate
  });
  const syncPermissionMutation = useMutation({
    mutationFn: syncPermissions,
    onSuccess: invalidate
  });
  const menuBindingMutation = useMutation({
    mutationFn: (apiPermissionIds: string[]) => updateMenuApiBindings(selected?.id ?? "", apiPermissionIds),
    onSuccess: invalidate
  });
  const rows = query.data ?? [];

  if (!canView) {
    return (
      <section className="rounded-lg border bg-card p-8 text-center">
        <AlertCircle className="mx-auto size-8 text-destructive" aria-hidden="true" />
        <h2 className="mt-3 text-base font-semibold">{translate(language, "common.permissionDenied")}</h2>
      </section>
    );
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_25rem]">
      <div className="space-y-4">
        <CoreToolbar
          canCreate={Boolean(config.create)}
          description={config.description}
          onCreate={() => setCreating(true)}
          onRefresh={() => void query.refetch()}
          onSync={
            kind === "permissions" && hasPermission(permissionCodes, "permission:sync")
              ? () => syncPermissionMutation.mutate()
              : undefined
          }
          route={route}
        />
        <div className="rounded-lg border bg-card shadow-sm">
          <CoreFilter keyword={keyword} onChange={setKeyword} />
          <CoreEntityTable
            columns={config.columns}
            isError={query.isError}
            isLoading={query.isLoading}
            onDelete={config.delete ? (record) => actionMutation.mutate({ record, action: "delete" }) : undefined}
            onEdit={config.update ? setEditing : undefined}
            onSelect={kind === "roles" || kind === "menus" ? setSelected : undefined}
            onStatusAction={(record, action) => actionMutation.mutate({ record, action })}
            rows={rows}
            selectedId={selected?.id}
            statusActions={config.statusActions}
          />
        </div>
      </div>
      <aside className="space-y-4">
        {creating && config.create ? (
          <CoreEntityForm
            busy={createMutation.isPending}
            fields={fields}
            initialValues={config.initialValues()}
            mode="create"
            onCancel={() => setCreating(false)}
            onSubmit={(values) => createMutation.mutate(values)}
            title={`Create ${config.label}`}
          />
        ) : null}
        {editing && config.update ? (
          <CoreEntityForm
            busy={updateMutation.isPending}
            fields={fields.filter((field) => field.type !== "password" && !(kind === "users" && field.name === "roleId"))}
            initialValues={config.initialValues(editing)}
            key={editing.id}
            mode="edit"
            onCancel={() => setEditing(null)}
            onSubmit={(values) => updateMutation.mutate({ id: editing.id, values })}
            title={`Edit ${config.label}`}
          />
        ) : null}
        {kind === "roles" && selected ? (
          <CoreAssignmentPanel
            busy={rolePermissionMutation.isPending}
            description="grant or remove API/menu capability permissions for this role"
            initialSelected={rolePermissionsQuery.data ?? []}
            items={permissionsQuery.data ?? []}
            key={`role-${selected.id}-${(rolePermissionsQuery.data ?? []).join(",")}`}
            onSave={(values) => rolePermissionMutation.mutate(values)}
            selectedRecordName={displayValue(selected, ["name", "code"], selected.id)}
            title="Role permissions"
            valueKey="code"
          />
        ) : null}
        {kind === "menus" && selected ? (
          <CoreAssignmentPanel
            busy={menuBindingMutation.isPending}
            description="bind API permission metadata to the selected menu"
            initialSelected={readStringArray(selected.apiPermissionIds)}
            items={apiPermissionsQuery.data ?? []}
            key={`menu-${selected.id}-${readStringArray(selected.apiPermissionIds).join(",")}`}
            onSave={(values) => menuBindingMutation.mutate(values)}
            selectedRecordName={displayValue(selected, ["titleI18nKey", "code"], selected.id)}
            title="Menu API bindings"
            valueKey="id"
          />
        ) : null}
        {!creating && !editing && !selected ? (
          <section className="rounded-lg border bg-card p-4 shadow-sm">
            <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
            <h3 className="mt-3 text-sm font-semibold">{config.label} operations</h3>
            <p className="mt-1 text-sm text-muted-foreground">{config.sidePanel}</p>
          </section>
        ) : null}
        {actionMutation.isError || createMutation.isError || updateMutation.isError || syncPermissionMutation.isError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            The operation failed.
          </div>
        ) : null}
      </aside>
    </section>
  );
}

function CoreToolbar({
  canCreate,
  description,
  onCreate,
  onRefresh,
  onSync,
  route
}: {
  canCreate: boolean;
  description: string;
  onCreate: () => void;
  onRefresh: () => void;
  onSync?: () => void;
  route: WebAdminRouteMetadata;
}) {
  const language = useLayoutStore((state) => state.language);
  return (
    <div className="flex items-end justify-between gap-4 rounded-lg border bg-card p-4 shadow-sm">
      <div>
        <h2 className="text-base font-semibold">{translate(language, route.titleI18nKey)}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex gap-2">
        <Button onClick={onRefresh} size="sm" variant="outline">
          <RefreshCw className="size-4" aria-hidden="true" />
          Refresh
        </Button>
        {canCreate ? (
          <Button onClick={onCreate} size="sm">
            <Plus className="size-4" aria-hidden="true" />
            Create
          </Button>
        ) : null}
        {onSync ? (
          <Button onClick={onSync} size="sm">
            Sync
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function CoreFilter({ keyword, onChange }: { keyword: string; onChange: (value: string) => void }) {
  return (
    <div className="flex items-center gap-3 border-b p-4">
      <label className="flex min-w-80 items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
        <Search className="size-4 text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Filter</span>
        <input
          className="w-full bg-transparent outline-none"
          onChange={(event) => onChange(event.target.value)}
          placeholder="Filter"
          value={keyword}
        />
      </label>
      <Button onClick={() => onChange("")} size="sm" variant="ghost">
        Reset
      </Button>
    </div>
  );
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
