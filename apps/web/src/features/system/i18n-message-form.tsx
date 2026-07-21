import { useForm } from "@tanstack/react-form";
import type { UpdateI18nMessageRequest } from "@web-admin-base/contracts";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { I18nMessage } from "./i18n-message-api";
import { i18nMessageFormSchema, toI18nMessageApiInput } from "./i18n-message-model";

type I18nMessageFormProps = {
  busy: boolean;
  initialRecord: I18nMessage;
  onCancel: () => void;
  onSubmit: (input: UpdateI18nMessageRequest) => void;
};

export function I18nMessageForm({ busy, initialRecord, onCancel, onSubmit }: I18nMessageFormProps) {
  const form = useForm({
    defaultValues: { overrideValue: initialRecord.overrideValue ?? "" },
    validators: { onSubmit: i18nMessageFormSchema },
    onSubmit: ({ value }) => onSubmit(toI18nMessageApiInput(value)),
  });

  return (
    <section className="rounded-lg border bg-card p-4 shadow-sm">
      <h3 className="text-sm font-semibold">Edit message</h3>
      <dl className="mt-3 grid gap-2 text-xs text-muted-foreground">
        <div>
          <dt className="font-medium text-foreground">Key</dt>
          <dd className="mt-1 break-all">{initialRecord.messageKey}</dd>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <dt className="font-medium text-foreground">Language</dt>
            <dd className="mt-1">{initialRecord.language}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Module</dt>
            <dd className="mt-1">{initialRecord.module || "-"}</dd>
          </div>
        </div>
        <div>
          <dt className="font-medium text-foreground">Manifest default</dt>
          <dd className="mt-1 whitespace-pre-wrap text-foreground">
            {initialRecord.defaultMessage}
          </dd>
        </div>
      </dl>
      <form
        className="mt-4 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.Field
          name="overrideValue"
          children={(field) => (
            <label className="block text-sm font-medium">
              Administrator override
              <textarea
                className="mt-2 min-h-40 w-full rounded-md border bg-background px-3 py-2"
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                value={field.state.value}
                placeholder="Leave empty to use the manifest default"
              />
            </label>
          )}
        />
        <div className="flex justify-end gap-2">
          <Button onClick={onCancel} type="button" variant="ghost">
            Cancel
          </Button>
          {initialRecord.overrideValue !== null ? (
            <Button
              disabled={busy}
              onClick={() => onSubmit({ overrideValue: null })}
              type="button"
              variant="outline"
            >
              Restore default
            </Button>
          ) : null}
          <Button disabled={busy} type="submit">
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            Save
          </Button>
        </div>
      </form>
    </section>
  );
}
