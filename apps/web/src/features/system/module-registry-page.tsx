import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Boxes, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { hasPermission } from "@/features/permissions/permission-utils";
import { translate } from "@/i18n/messages";
import type { WebAdminRouteMetadata } from "@/route-metadata";
import { useAuthStore } from "@/stores/auth.store";
import { useLayoutStore } from "@/stores/layout.store";
import { applyModuleSync, fetchModuleRegistry, fetchModuleSyncPlan } from "./module-registry-api";
import { ModuleRegistryTable } from "./module-registry-table";
import { ModuleSyncPlanPanel } from "./module-sync-plan-panel";

const registryQueryKey = ["business-module-registry"] as const;
const planQueryKey = ["business-module-sync-plan"] as const;

export function ModuleRegistryPage({ route }: { route: WebAdminRouteMetadata }) {
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const language = useLayoutStore((state) => state.language);
  const canView = hasPermission(permissionCodes, route.requiredPermission);
  const canSync = hasPermission(permissionCodes, "module-registry:sync");
  const queryClient = useQueryClient();
  const registryQuery = useQuery({
    enabled: canView,
    queryKey: registryQueryKey,
    queryFn: fetchModuleRegistry,
  });
  const planQuery = useQuery({
    enabled: canView,
    queryKey: planQueryKey,
    queryFn: fetchModuleSyncPlan,
  });
  const applyMutation = useMutation({
    mutationFn: applyModuleSync,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: registryQueryKey }),
        queryClient.invalidateQueries({ queryKey: planQueryKey }),
      ]);
    },
  });

  if (!canView) return <PermissionDenied language={language} />;

  const applyReviewedPlan = () => {
    if (!planQuery.data) return;
    if (!window.confirm(translate(language, "modules.plan.confirm"))) return;
    applyMutation.mutate(planQuery.data.registryHash);
  };

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Boxes className="size-5 text-primary" aria-hidden="true" />
            <h2 className="text-base font-semibold">
              {translate(language, "routes.system.modules")}
            </h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {translate(language, "modules.description")}
          </p>
        </div>
        <Button onClick={() => void registryQuery.refetch()} size="sm" variant="outline">
          <RefreshCw className="size-4" aria-hidden="true" />
          {translate(language, "modules.refresh")}
        </Button>
      </header>
      <section className="border bg-card" aria-label="Business Module catalog">
        <ModuleRegistryTable
          isError={registryQuery.isError}
          isLoading={registryQuery.isLoading}
          language={language}
          modules={registryQuery.data?.modules ?? []}
        />
      </section>
      <ModuleSyncPlanPanel
        applyError={applyMutation.isError}
        canSync={canSync}
        isApplying={applyMutation.isPending}
        isError={planQuery.isError}
        isLoading={planQuery.isLoading}
        language={language}
        onApply={applyReviewedPlan}
        onRefresh={() => void planQuery.refetch()}
        plan={planQuery.data}
      />
    </div>
  );
}

function PermissionDenied({ language }: { language: "en" | "zh" }) {
  return (
    <section className="border bg-card p-8 text-center">
      <AlertCircle className="mx-auto size-8 text-destructive" aria-hidden="true" />
      <h2 className="mt-3 text-base font-semibold">
        {translate(language, "common.permissionDenied")}
      </h2>
    </section>
  );
}
