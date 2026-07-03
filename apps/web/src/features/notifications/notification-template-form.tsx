import { useForm } from "@tanstack/react-form";
import type {
  CreateNotificationTemplateRequest,
  UpdateNotificationTemplateRequest
} from "@web-admin-base/contracts";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { NotificationTemplate } from "./notification-template-api";
import {
  defaultNotificationTemplateFormValues,
  notificationTemplateFormSchema,
  toNotificationTemplateApiInput,
  type NotificationTemplateFormMode
} from "./notification-template-model";

type NotificationTemplateFormProps = {
  busy: boolean;
  initialRecord?: NotificationTemplate;
  mode: NotificationTemplateFormMode;
  onCancel: () => void;
  onSubmit: (input: CreateNotificationTemplateRequest | UpdateNotificationTemplateRequest) => void;
};

export function NotificationTemplateForm({
  busy,
  initialRecord,
  mode,
  onCancel,
  onSubmit
}: NotificationTemplateFormProps) {
  const initialValues = initialRecord
    ? {
        code: initialRecord.code,
        channel: initialRecord.channel,
        locale: initialRecord.locale,
        subject: initialRecord.subject ?? "",
        body: initialRecord.body,
        variablesText: initialRecord.variables.join(", ")
      }
    : defaultNotificationTemplateFormValues;
  const form = useForm({
    defaultValues: initialValues,
    validators: { onSubmit: notificationTemplateFormSchema },
    onSubmit: ({ value }) => onSubmit(toNotificationTemplateApiInput(value, mode))
  });

  return (
    <section className="rounded-lg border bg-card p-4 shadow-sm">
      <h3 className="text-sm font-semibold">
        {mode === "create" ? "Create notification template" : "Edit notification template"}
      </h3>
      <form
        className="mt-4 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.Field
          name="code"
          children={(field) => (
            <label className="block text-sm font-medium">
              Code
              <input
                className="mt-2 h-10 w-full rounded-md border bg-background px-3"
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                value={field.state.value}
              />
            </label>
          )}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <form.Field
            name="channel"
            children={(field) => (
              <label className="block text-sm font-medium">
                Channel
                <select
                  className="mt-2 h-10 w-full rounded-md border bg-background px-3"
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value as "in_app" | "email" | "sms")}
                  value={field.state.value}
                >
                  <option value="in_app">In-app</option>
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                </select>
              </label>
            )}
          />
          <form.Field
            name="locale"
            children={(field) => (
              <label className="block text-sm font-medium">
                Locale
                <input
                  className="mt-2 h-10 w-full rounded-md border bg-background px-3"
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="en"
                  value={field.state.value}
                />
              </label>
            )}
          />
        </div>
        <form.Field
          name="subject"
          children={(field) => (
            <label className="block text-sm font-medium">
              Subject
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
          name="body"
          children={(field) => (
            <label className="block text-sm font-medium">
              Body
              <textarea
                className="mt-2 min-h-32 w-full rounded-md border bg-background px-3 py-2"
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                value={field.state.value}
              />
            </label>
          )}
        />
        <form.Field
          name="variablesText"
          children={(field) => (
            <label className="block text-sm font-medium">
              Variables
              <input
                className="mt-2 h-10 w-full rounded-md border bg-background px-3"
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="userName, organizationName"
                value={field.state.value}
              />
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
