import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Loader2, Search } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { fetchPageDataset } from "@/lib/api-client";
import type { WebAdminRouteMetadata } from "@/route-metadata";
import { hasPermission, isFieldHidden } from "@/features/permissions/permission-utils";
import { translate } from "@/i18n/messages";
import { useAuthStore } from "@/stores/auth.store";
import { useLayoutStore } from "@/stores/layout.store";

type ManagementPageProps = {
  route: WebAdminRouteMetadata;
};

const columns = ["name", "code", "status", "owner", "updatedAt"] as const;

export function ManagementPage({ route }: ManagementPageProps) {
  const [keyword, setKeyword] = useState("");
  const language = useLayoutStore((state) => state.language);
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const hiddenFields = useAuthStore((state) => state.hiddenFields);
  const canView = hasPermission(permissionCodes, route.requiredPermission);
  const query = useQuery({
    enabled: canView,
    queryKey: ["page-dataset", route.routeCode],
    queryFn: () => fetchPageDataset(route.routeCode),
  });

  if (!canView) {
    return (
      <section className="rounded-lg border bg-card p-8 text-center">
        <AlertCircle className="mx-auto size-8 text-destructive" aria-hidden="true" />
        <h2 className="mt-3 text-base font-semibold">
          {translate(language, "common.permissionDenied")}
        </h2>
      </section>
    );
  }

  const rows =
    query.data?.records.filter((record) =>
      [record.name, record.code, record.status].some((value) =>
        value.toLowerCase().includes(keyword.toLowerCase()),
      ),
    ) ?? [];
  const routeHiddenFields = {
    ...hiddenFields,
    [route.routeCode]: [
      ...(hiddenFields[route.routeCode] ?? []),
      ...(query.data?.hiddenFields ?? []),
    ],
  };

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4 rounded-lg border bg-card p-4 shadow-sm">
        <div>
          <h2 className="text-base font-semibold">{translate(language, route.titleI18nKey)}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {query.data?.mode === "typed-placeholder"
              ? translate(language, "common.integrationPending")
              : "Connected to the available backend foundation API boundary."}
          </p>
        </div>
        <div className="flex gap-2">
          {route.actions
            ?.filter((action) => hasPermission(permissionCodes, action.requiredPermission))
            .map((action) => (
              <Button key={action.code} size="sm">
                {translate(language, action.labelI18nKey)}
              </Button>
            ))}
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
              placeholder={translate(language, "actions.filter")}
              value={keyword}
            />
          </label>
          <Button onClick={() => void query.refetch()} size="sm" variant="outline">
            {translate(language, "actions.refresh")}
          </Button>
          <Button onClick={() => setKeyword("")} size="sm" variant="ghost">
            {translate(language, "actions.reset")}
          </Button>
        </div>
        {query.isLoading ? (
          <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {translate(language, "common.loading")}
          </div>
        ) : query.isError ? (
          <div className="p-8 text-sm text-destructive">{translate(language, "common.error")}</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-sm text-muted-foreground">
            {translate(language, "common.empty")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  {columns
                    .filter((column) => !isFieldHidden(routeHiddenFields, route.routeCode, column))
                    .map((column) => (
                      <th className="border-b px-4 py-3 font-medium" key={column}>
                        {column}
                      </th>
                    ))}
                  <th className="border-b px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr className="hover:bg-muted/40" key={row.id}>
                    {columns
                      .filter(
                        (column) => !isFieldHidden(routeHiddenFields, route.routeCode, column),
                      )
                      .map((column) => (
                        <td className="border-b px-4 py-3" key={column}>
                          {row[column]}
                        </td>
                      ))}
                    <td className="border-b px-4 py-3">
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          {translate(language, "actions.edit")}
                        </Button>
                        <Button size="sm" variant="ghost">
                          {translate(language, "actions.delete")}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
