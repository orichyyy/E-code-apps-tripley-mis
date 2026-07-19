import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { translate } from "@/i18n/messages";
import { useLayoutStore } from "@/stores/layout.store";

export type AnnouncementFilterValues = {
  status: "" | "draft" | "published";
  scopeType: "" | "system" | "organization";
  publishedFrom: string;
  publishedTo: string;
};

export const emptyAnnouncementFilters: AnnouncementFilterValues = {
  status: "",
  scopeType: "",
  publishedFrom: "",
  publishedTo: "",
};

export function AnnouncementFilters({
  value,
  onChange,
}: {
  value: AnnouncementFilterValues;
  onChange: (value: AnnouncementFilterValues) => void;
}) {
  const language = useLayoutStore((state) => state.language);
  const update = (field: keyof AnnouncementFilterValues, next: string) =>
    onChange({ ...value, [field]: next });
  return (
    <div className="grid gap-3 border-b p-4 md:grid-cols-2 xl:grid-cols-[12rem_12rem_1fr_1fr_auto]">
      <FilterSelect
        label={translate(language, "announcements.status")}
        value={value.status}
        onChange={(next) => update("status", next)}
      >
        <option value="">{translate(language, "announcements.allStatuses")}</option>
        <option value="draft">{translate(language, "announcements.draft")}</option>
        <option value="published">{translate(language, "announcements.published")}</option>
      </FilterSelect>
      <FilterSelect
        label={translate(language, "announcements.scope")}
        value={value.scopeType}
        onChange={(next) => update("scopeType", next)}
      >
        <option value="">{translate(language, "announcements.allScopes")}</option>
        <option value="system">{translate(language, "announcements.system")}</option>
        <option value="organization">{translate(language, "announcements.organization")}</option>
      </FilterSelect>
      <DateFilter
        label={translate(language, "announcements.publishedFrom")}
        value={value.publishedFrom}
        onChange={(next) => update("publishedFrom", next)}
      />
      <DateFilter
        label={translate(language, "announcements.publishedTo")}
        value={value.publishedTo}
        onChange={(next) => update("publishedTo", next)}
      />
      <Button
        onClick={() => onChange(emptyAnnouncementFilters)}
        size="icon"
        title={translate(language, "announcements.resetFilters")}
        variant="ghost"
      >
        <RotateCcw className="size-4" aria-hidden="true" />
        <span className="sr-only">{translate(language, "announcements.resetFilters")}</span>
      </Button>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="text-xs font-medium text-muted-foreground">
      {label}
      <select
        className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {children}
      </select>
    </label>
  );
}

function DateFilter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-xs font-medium text-muted-foreground">
      {label}
      <input
        className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground"
        onChange={(event) => onChange(event.target.value)}
        type="datetime-local"
        value={value}
      />
    </label>
  );
}
