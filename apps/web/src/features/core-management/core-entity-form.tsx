import { useForm } from "@tanstack/react-form";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CoreField, CoreFormValues } from "./core-management-model";

type CoreEntityFormProps = {
  busy: boolean;
  fields: CoreField[];
  initialValues: CoreFormValues;
  mode: "create" | "edit";
  title: string;
  onCancel: () => void;
  onSubmit: (values: CoreFormValues) => void;
};

export function CoreEntityForm({
  busy,
  fields,
  initialValues,
  mode,
  title,
  onCancel,
  onSubmit,
}: CoreEntityFormProps) {
  const form = useForm({
    defaultValues: initialValues,
    onSubmit: ({ value }) => onSubmit(value),
  });

  return (
    <section className="rounded-lg border bg-card p-4 shadow-sm">
      <h3 className="text-sm font-semibold">{title}</h3>
      <form
        className="mt-4 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        {fields.map((fieldConfig) => (
          <form.Field
            key={fieldConfig.name}
            name={fieldConfig.name}
            children={(field) => (
              <label className="block text-sm font-medium">
                {fieldConfig.label}
                {fieldConfig.type === "textarea" ? (
                  <textarea
                    className="mt-2 min-h-24 w-full rounded-md border bg-background px-3 py-2"
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    value={String(field.state.value ?? "")}
                  />
                ) : fieldConfig.type === "select" ? (
                  <select
                    className="mt-2 h-10 w-full rounded-md border bg-background px-3"
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    value={String(field.state.value ?? "")}
                  >
                    <option value="">None</option>
                    {fieldConfig.options?.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : fieldConfig.type === "checkbox" ? (
                  <span className="mt-2 flex h-10 items-center gap-2">
                    <input
                      checked={Boolean(field.state.value)}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.checked)}
                      type="checkbox"
                    />
                    <span className="text-sm text-muted-foreground">Enabled</span>
                  </span>
                ) : (
                  <input
                    className="mt-2 h-10 w-full rounded-md border bg-background px-3"
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    required={fieldConfig.required}
                    type={fieldConfig.type ?? "text"}
                    value={String(field.state.value ?? "")}
                  />
                )}
              </label>
            )}
          />
        ))}
        <div className="flex justify-end gap-2">
          <Button onClick={onCancel} type="button" variant="ghost">
            Cancel
          </Button>
          <Button disabled={busy} type="submit">
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {mode === "create" ? "Create" : "Save"}
          </Button>
        </div>
      </form>
    </section>
  );
}
