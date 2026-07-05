import { useForm } from "@tanstack/react-form";
import { Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ExportTaskForm({
  busy,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  onCancel: () => void;
  onSubmit: (resourceType: string) => void;
}) {
  const form = useForm({
    defaultValues: { resourceType: "logs:login" },
    onSubmit: ({ value }) => onSubmit(value.resourceType),
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
      <h3 className="font-semibold">Create export task</h3>
      <p className="mt-1 text-muted-foreground">
        Use confirmed resource types such as logs:login or logs:operation.
      </p>
      <form.Field name="resourceType">
        {(field) => (
          <label className="mt-4 flex flex-col gap-1">
            <span className="font-medium">Resource type</span>
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
      <div className="mt-4 flex justify-end gap-2">
        <Button disabled={busy} onClick={onCancel} size="sm" type="button" variant="ghost">
          Cancel
        </Button>
        <Button disabled={busy} size="sm" type="submit">
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="size-4" aria-hidden="true" />
          )}
          Create
        </Button>
      </div>
    </form>
  );
}
