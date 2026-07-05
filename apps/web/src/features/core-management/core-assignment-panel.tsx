import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { displayValue, type CoreEntity } from "./core-management-model";

type CoreAssignmentPanelProps = {
  busy: boolean;
  description: string;
  initialSelected: string[];
  items: CoreEntity[];
  selectedRecordName: string;
  title: string;
  valueKey: "code" | "id";
  onSave: (values: string[]) => void;
};

export function CoreAssignmentPanel({
  busy,
  description,
  initialSelected,
  items,
  selectedRecordName,
  title,
  valueKey,
  onSave
}: CoreAssignmentPanelProps) {
  const [keyword, setKeyword] = useState("");
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const visibleItems = items.filter((item) =>
    [
      displayValue(item, ["code"], ""),
      displayValue(item, ["name", "titleI18nKey", "path", "method"], "")
    ]
      .join(" ")
      .toLowerCase()
      .includes(keyword.toLowerCase())
  );
  const toggle = (value: string) => {
    setSelected((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  };

  return (
    <section className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {selectedRecordName}: {description}
          </p>
        </div>
        <Button disabled={busy} onClick={() => onSave(selected)} size="sm">
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          Save
        </Button>
      </div>
      <input
        className="mt-4 h-9 w-full rounded-md border bg-background px-3 text-sm"
        onChange={(event) => setKeyword(event.target.value)}
        placeholder="Filter assignments"
        value={keyword}
      />
      <div className="mt-3 max-h-96 space-y-1 overflow-auto pr-1">
        {visibleItems.map((item) => {
          const value = valueKey === "code" ? displayValue(item, ["code"], "") : item.id;
          if (!value) return null;
          return (
            <label
              className="flex items-start gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted/50"
              key={value}
            >
              <input
                checked={selectedSet.has(value)}
                className="mt-1"
                onChange={() => toggle(value)}
                type="checkbox"
              />
              <span>
                <span className="block font-medium">
                  {displayValue(item, ["code", "name", "titleI18nKey", "path"], value)}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {displayValue(item, ["name", "path", "method", "resource"], "")}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
}
