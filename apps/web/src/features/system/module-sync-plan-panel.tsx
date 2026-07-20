import type { ModuleSyncPlanResponse } from "@web-admin-base/contracts";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { translate, type Language } from "@/i18n/messages";

type ModuleSyncPlanPanelProps = {
  plan: ModuleSyncPlanResponse | undefined;
  canSync: boolean;
  isLoading: boolean;
  isError: boolean;
  isApplying: boolean;
  applyError: boolean;
  onApply: () => void;
  onRefresh: () => void;
  language: Language;
};

export function ModuleSyncPlanPanel(props: ModuleSyncPlanPanelProps) {
  const { plan } = props;
  return (
    <section className="border bg-card" aria-labelledby="module-sync-plan-title">
      <header className="flex items-center justify-between gap-4 border-b px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold" id="module-sync-plan-title">
            {translate(props.language, "modules.plan.title")}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {translate(props.language, "modules.plan.description")}
          </p>
        </div>
        <Button onClick={props.onRefresh} size="sm" variant="outline">
          <RefreshCw className="size-4" aria-hidden="true" />
          {translate(props.language, "modules.plan.refresh")}
        </Button>
      </header>
      <div className="space-y-4 p-4">
        {props.isLoading ? (
          <PlanState text={translate(props.language, "modules.plan.loading")} />
        ) : null}
        {props.isError ? (
          <PlanState destructive text={translate(props.language, "modules.plan.loadError")} />
        ) : null}
        {plan ? <PlanDetails language={props.language} plan={plan} /> : null}
        {props.applyError ? (
          <PlanState destructive text={translate(props.language, "modules.plan.applyError")} />
        ) : null}
        <div className="flex items-center justify-between gap-4 border-t pt-4">
          <p className="text-xs text-muted-foreground">
            {translate(props.language, "modules.plan.auditNote")}
          </p>
          <Button
            disabled={
              !props.canSync || !plan?.canApply || plan.changes.length === 0 || props.isApplying
            }
            onClick={props.onApply}
          >
            <CheckCircle2 className="size-4" aria-hidden="true" />
            {props.isApplying
              ? translate(props.language, "modules.plan.applying")
              : translate(props.language, "modules.plan.apply")}
          </Button>
        </div>
      </div>
    </section>
  );
}

function PlanDetails({ plan, language }: { plan: ModuleSyncPlanResponse; language: Language }) {
  return (
    <>
      <dl className="grid gap-3 text-xs sm:grid-cols-2">
        <HashValue
          label={translate(language, "modules.plan.releaseHash")}
          value={plan.registryHash}
        />
        <HashValue
          label={translate(language, "modules.plan.acceptedHash")}
          value={plan.acceptedRegistryHash}
        />
      </dl>
      {plan.dependencyFailures.length > 0 ? (
        <div className="border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="size-4" aria-hidden="true" />
            {translate(language, "modules.plan.dependenciesBlock")}
          </p>
          {plan.dependencyFailures.map((failure) => (
            <p className="mt-1 text-xs" key={`${failure.moduleCode}:${failure.dictionaryTypeCode}`}>
              {failure.moduleCode}: {failure.dictionaryTypeCode}
            </p>
          ))}
        </div>
      ) : null}
      {plan.changes.length === 0 ? (
        <PlanState text={translate(language, "modules.plan.matches")} />
      ) : (
        <ul className="divide-y border" aria-label="Module sync changes">
          {plan.changes.map((change) => (
            <li
              className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm"
              key={change.moduleCode}
            >
              <span>
                <strong>{change.moduleCode}</strong>
                <span className="ml-2 text-xs text-muted-foreground">
                  {change.type} · {change.drift}
                </span>
              </span>
              <span className="text-xs text-muted-foreground">
                {bindingCount(change.authorizationBindingsRemoved)}{" "}
                {translate(language, "modules.plan.bindingsRemoved")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function HashValue({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate font-mono" title={value ?? "-"}>
        {value ?? "-"}
      </dd>
    </div>
  );
}

function bindingCount(
  removals: ModuleSyncPlanResponse["changes"][number]["authorizationBindingsRemoved"],
) {
  return removals.reduce(
    (total, item) => total + item.roleBindingCount + item.dataRuleCount + item.userOverrideCount,
    0,
  );
}

function PlanState({ text, destructive = false }: { text: string; destructive?: boolean }) {
  return (
    <p className={destructive ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
      {text}
    </p>
  );
}
