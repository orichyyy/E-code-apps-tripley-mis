import { useForm } from "@tanstack/react-form";
import type {
  CreateWebhookSubscriptionRequest,
  UpdateWebhookSubscriptionRequest
} from "@web-admin-base/contracts";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { WebhookSubscription } from "./webhook-subscription-api";
import {
  defaultWebhookFormValues,
  toWebhookApiInput,
  webhookFormSchema,
  type WebhookFormMode
} from "./webhook-subscription-model";

type WebhookFormProps = {
  busy: boolean;
  initialRecord?: WebhookSubscription;
  mode: WebhookFormMode;
  onCancel: () => void;
  onSubmit: (input: CreateWebhookSubscriptionRequest | UpdateWebhookSubscriptionRequest) => void;
};

export function WebhookSubscriptionForm({
  busy,
  initialRecord,
  mode,
  onCancel,
  onSubmit
}: WebhookFormProps) {
  const initialValues = initialRecord
    ? {
        name: initialRecord.name,
        url: initialRecord.url,
        eventTypesText: initialRecord.eventTypes.join(", "),
        secret: "",
        status: initialRecord.status
      }
    : defaultWebhookFormValues;
  const form = useForm({
    defaultValues: initialValues,
    validators: { onSubmit: webhookFormSchema },
    onSubmit: ({ value }) => onSubmit(toWebhookApiInput(value, mode))
  });

  return (
    <section className="rounded-lg border bg-card p-4 shadow-sm">
      <h3 className="text-sm font-semibold">{mode === "create" ? "Create webhook" : "Edit webhook"}</h3>
      <form
        className="mt-4 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.Field
          name="name"
          children={(field) => (
            <label className="block text-sm font-medium">
              Name
              <input
                className="mt-2 h-10 w-full rounded-md border bg-background px-3"
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                value={field.state.value}
              />
            </label>
          )}
        />
        <form.Field
          name="url"
          children={(field) => (
            <label className="block text-sm font-medium">
              URL
              <input
                className="mt-2 h-10 w-full rounded-md border bg-background px-3"
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                value={field.state.value}
              />
            </label>
          )}
        />
        <form.Field
          name="eventTypesText"
          children={(field) => (
            <label className="block text-sm font-medium">
              Event types
              <input
                className="mt-2 h-10 w-full rounded-md border bg-background px-3"
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="announcement.published, security.event"
                value={field.state.value}
              />
            </label>
          )}
        />
        <form.Field
          name="secret"
          children={(field) => (
            <label className="block text-sm font-medium">
              {mode === "create" ? "Secret" : "Replace secret"}
              <input
                className="mt-2 h-10 w-full rounded-md border bg-background px-3"
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder={mode === "create" ? "Optional signing secret" : "Leave blank to keep existing secret"}
                type="password"
                value={field.state.value}
              />
            </label>
          )}
        />
        <form.Field
          name="status"
          children={(field) => (
            <label className="block text-sm font-medium">
              Status
              <select
                className="mt-2 h-10 w-full rounded-md border bg-background px-3"
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value as "enabled" | "disabled")}
                value={field.state.value}
              >
                <option value="enabled">Enabled</option>
                <option value="disabled">Disabled</option>
              </select>
            </label>
          )}
        />
        <div className="flex justify-end gap-2">
          <Button onClick={onCancel} type="button" variant="ghost">
            Cancel
          </Button>
          <Button disabled={busy} type="submit">
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            Save
          </Button>
        </div>
      </form>
    </section>
  );
}
