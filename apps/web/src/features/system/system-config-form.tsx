import { useForm } from "@tanstack/react-form";
import {
  updateSystemConfigRequestSchema,
  type UpdateSystemConfigRequest,
} from "@web-admin-base/contracts";
import { Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { SystemConfig } from "./system-management-api";

type SystemConfigFormProps = {
  busy: boolean;
  record: SystemConfig;
  onCancel: () => void;
  onSubmit: (input: UpdateSystemConfigRequest) => void;
};

type SystemConfigFormValues = {
  rawValue: string;
  booleanValue: boolean;
};

export function SystemConfigForm({ busy, record, onCancel, onSubmit }: SystemConfigFormProps) {
  const [parseError, setParseError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: toFormValues(record),
    onSubmit: ({ value }) => {
      const parsed = parseConfigValue(record.valueType, value);
      if (!parsed.ok) {
        setParseError(parsed.message);
        return;
      }
      setParseError(null);
      onSubmit(updateSystemConfigRequestSchema.parse({ configValue: parsed.value }));
    },
  });

  return (
    <form
      className="rounded-lg border bg-card p-4 text-sm shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <div>
        <h3 className="font-semibold">Edit configuration</h3>
        <p className="mt-1 break-all text-muted-foreground">{record.configKey}</p>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="text-muted-foreground">Group</dt>
          <dd className="mt-1 font-medium">{record.groupKey}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Value type</dt>
          <dd className="mt-1 font-medium">{record.valueType}</dd>
        </div>
      </dl>
      <div className="mt-4">
        {record.valueType === "boolean" ? (
          <form.Field name="booleanValue">
            {(field) => (
              <label className="flex items-center gap-2">
                <input
                  checked={field.state.value}
                  disabled={busy}
                  onChange={(event) => field.handleChange(event.target.checked)}
                  type="checkbox"
                />
                <span className="font-medium">Enabled value</span>
              </label>
            )}
          </form.Field>
        ) : (
          <form.Field name="rawValue">
            {(field) => (
              <label className="flex flex-col gap-1">
                <span className="font-medium">Value</span>
                {record.valueType === "json" ? (
                  <textarea
                    className="min-h-40 rounded-md border bg-background px-3 py-2 font-mono text-xs outline-none"
                    disabled={busy}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    value={field.state.value}
                  />
                ) : (
                  <input
                    className="rounded-md border bg-background px-3 py-2 outline-none"
                    disabled={busy}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    type={record.valueType === "number" ? "number" : "text"}
                    value={field.state.value}
                  />
                )}
              </label>
            )}
          </form.Field>
        )}
      </div>
      {parseError ? <div className="mt-3 text-sm text-destructive">{parseError}</div> : null}
      <div className="mt-4 flex justify-end gap-2">
        <Button disabled={busy} onClick={onCancel} size="sm" type="button" variant="ghost">
          Cancel
        </Button>
        <Button disabled={busy || !record.editable} size="sm" type="submit">
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          Save
        </Button>
      </div>
    </form>
  );
}

function toFormValues(record: SystemConfig): SystemConfigFormValues {
  return {
    rawValue:
      record.valueType === "json"
        ? JSON.stringify(record.configValue, null, 2)
        : String(record.configValue ?? ""),
    booleanValue: record.configValue === true,
  };
}

function parseConfigValue(
  valueType: SystemConfig["valueType"],
  value: SystemConfigFormValues,
):
  | { ok: true; value: string | number | boolean | Record<string, unknown> | unknown[] }
  | { ok: false; message: string } {
  if (valueType === "boolean") return { ok: true, value: value.booleanValue };
  if (valueType === "number") {
    const parsed = Number(value.rawValue);
    return Number.isFinite(parsed)
      ? { ok: true, value: parsed }
      : { ok: false, message: "Value must be a valid number." };
  }
  if (valueType === "json") {
    try {
      const parsed = JSON.parse(value.rawValue) as unknown;
      if (typeof parsed !== "object" || parsed === null)
        return { ok: false, message: "JSON value must be an object or array." };
      return { ok: true, value: parsed as Record<string, unknown> | unknown[] };
    } catch {
      return { ok: false, message: "Value must be valid JSON." };
    }
  }
  return { ok: true, value: value.rawValue };
}
