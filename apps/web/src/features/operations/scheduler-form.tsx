import { useForm } from "@tanstack/react-form";
import {
  createScheduledTaskRequestSchema,
  type CreateScheduledTaskRequest
} from "@web-admin-base/contracts";
import { Loader2 } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import type { ScheduledTask } from "./operations-api";

type SchedulerFormValues = {
  code: string;
  cronExpression: string;
  handlerType: string;
  payloadJson: string;
  enabled: boolean;
};

type SchedulerFormProps = {
  busy: boolean;
  initialRecord?: ScheduledTask;
  mode: "create" | "edit";
  onCancel: () => void;
  onSubmit: (input: CreateScheduledTaskRequest) => void;
};

const payloadSchema = z.string().transform((value, context) => {
  try {
    const parsed = value.trim() === "" ? {} : JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      context.addIssue({ code: "custom", message: "Payload must be a JSON object." });
      return z.NEVER;
    }
    return parsed as Record<string, unknown>;
  } catch {
    context.addIssue({ code: "custom", message: "Payload must be valid JSON." });
    return z.NEVER;
  }
});

export function SchedulerForm({ busy, initialRecord, mode, onCancel, onSubmit }: SchedulerFormProps) {
  const form = useForm({
    defaultValues: toDefaultValues(initialRecord),
    onSubmit: ({ value }) => {
      const payload = payloadSchema.parse(value.payloadJson);
      onSubmit(createScheduledTaskRequestSchema.parse({
        code: value.code,
        cronExpression: value.cronExpression,
        handlerType: value.handlerType,
        payload,
        enabled: value.enabled
      }));
    }
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
      <div className="mb-4">
        <h3 className="font-semibold">{mode === "create" ? "Create scheduled task" : "Edit scheduled task"}</h3>
        <p className="mt-1 text-muted-foreground">Cron uses the confirmed five-field expression format.</p>
      </div>
      <div className="flex flex-col gap-3">
        <form.Field name="code">
          {(field) => (
            <label className="flex flex-col gap-1">
              <span className="font-medium">Code</span>
              <input
                className="rounded-md border bg-background px-3 py-2 outline-none"
                disabled={busy}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                value={field.state.value}
              />
            </label>
          )}
        </form.Field>
        <form.Field name="cronExpression">
          {(field) => (
            <label className="flex flex-col gap-1">
              <span className="font-medium">Cron expression</span>
              <input
                className="rounded-md border bg-background px-3 py-2 outline-none"
                disabled={busy}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="*/15 * * * *"
                value={field.state.value}
              />
            </label>
          )}
        </form.Field>
        <form.Field name="handlerType">
          {(field) => (
            <label className="flex flex-col gap-1">
              <span className="font-medium">Handler type</span>
              <input
                className="rounded-md border bg-background px-3 py-2 outline-none"
                disabled={busy}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                value={field.state.value}
              />
            </label>
          )}
        </form.Field>
        <form.Field name="payloadJson">
          {(field) => (
            <label className="flex flex-col gap-1">
              <span className="font-medium">Payload JSON</span>
              <textarea
                className="min-h-28 rounded-md border bg-background px-3 py-2 font-mono text-xs outline-none"
                disabled={busy}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                value={field.state.value}
              />
            </label>
          )}
        </form.Field>
        <form.Field name="enabled">
          {(field) => (
            <label className="flex items-center gap-2">
              <input
                checked={field.state.value}
                disabled={busy}
                onChange={(event) => field.handleChange(event.target.checked)}
                type="checkbox"
              />
              <span className="font-medium">Enabled</span>
            </label>
          )}
        </form.Field>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button disabled={busy} onClick={onCancel} size="sm" type="button" variant="ghost">
          Cancel
        </Button>
        <Button disabled={busy} size="sm" type="submit">
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          Save
        </Button>
      </div>
    </form>
  );
}

function toDefaultValues(record?: ScheduledTask): SchedulerFormValues {
  return {
    code: record?.code ?? "",
    cronExpression: record?.cronExpression ?? "*/15 * * * *",
    handlerType: record?.handlerType ?? "",
    payloadJson: JSON.stringify(record?.payload ?? {}, null, 2),
    enabled: record?.enabled ?? true
  };
}
