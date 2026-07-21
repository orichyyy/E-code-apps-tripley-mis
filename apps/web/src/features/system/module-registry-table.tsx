import type { BusinessModuleRegistryItem } from "@web-admin-base/contracts";

import { translate, type Language } from "@/i18n/messages";

type ModuleRegistryTableProps = {
  modules: BusinessModuleRegistryItem[];
  isLoading: boolean;
  isError: boolean;
  language: Language;
};

export function ModuleRegistryTable({
  modules,
  isLoading,
  isError,
  language,
}: ModuleRegistryTableProps) {
  if (isLoading) return <TableState text={translate(language, "modules.loading")} />;
  if (isError) return <TableState destructive text={translate(language, "modules.loadError")} />;
  if (modules.length === 0) {
    return <TableState text={translate(language, "modules.empty")} />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] text-left text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">{translate(language, "modules.module")}</th>
            <th className="px-4 py-3 font-medium">{translate(language, "modules.state")}</th>
            <th className="px-4 py-3 font-medium">{translate(language, "modules.drift")}</th>
            <th className="px-4 py-3 font-medium">
              {translate(language, "modules.contributions")}
            </th>
            <th className="px-4 py-3 font-medium">{translate(language, "modules.dependencies")}</th>
            <th className="px-4 py-3 font-medium">{translate(language, "modules.accepted")}</th>
          </tr>
        </thead>
        <tbody>
          {modules.map((module) => (
            <tr className="border-t align-top" key={module.moduleCode}>
              <td className="px-4 py-3">
                <p className="font-medium">{module.title.defaultMessage}</p>
                <code className="text-xs text-muted-foreground">{module.moduleCode}</code>
              </td>
              <td className="px-4 py-3">
                <StatusLabel language={language} value={module.state} />
              </td>
              <td className="px-4 py-3">
                <StatusLabel language={language} value={module.drift} />
              </td>
              <td className="max-w-80 px-4 py-3 text-xs text-muted-foreground">
                {formatContributionCounts(module.contributionCounts, language)}
              </td>
              <td className="px-4 py-3 text-xs">
                {module.dependencyFailures.length === 0 ? (
                  <span className="text-emerald-700 dark:text-emerald-400">
                    {translate(language, "modules.dependenciesSatisfied")}
                  </span>
                ) : (
                  <ul className="space-y-1 text-destructive">
                    {module.dependencyFailures.map((failure) => (
                      <li key={failure.dictionaryTypeCode}>{failure.dictionaryTypeCode}</li>
                    ))}
                  </ul>
                )}
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground">
                {module.acceptedAt
                  ? new Date(module.acceptedAt).toLocaleString()
                  : translate(language, "modules.notAccepted")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusLabel({ value, language }: { value: string; language: Language }) {
  const className =
    value === "active" || value === "none"
      ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
      : value === "disabled" || value === "removed"
        ? "border-neutral-300 bg-neutral-100 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
        : "border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
  return (
    <span className={`inline-flex rounded border px-2 py-0.5 text-xs ${className}`}>
      {translate(language, `modules.value.${value}`)}
    </span>
  );
}

function formatContributionCounts(
  counts: BusinessModuleRegistryItem["contributionCounts"],
  language: Language,
) {
  const nonempty = Object.entries(counts).filter(([, count]) => count > 0);
  return nonempty.length === 0
    ? translate(language, "modules.noContributions")
    : nonempty.map(([name, count]) => `${humanize(name)} ${count}`).join(" · ");
}

function humanize(value: string) {
  return value.replaceAll(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
}

function TableState({ text, destructive = false }: { text: string; destructive?: boolean }) {
  return (
    <div
      className={`p-8 text-center text-sm ${destructive ? "text-destructive" : "text-muted-foreground"}`}
      role={destructive ? "alert" : "status"}
    >
      {text}
    </div>
  );
}
