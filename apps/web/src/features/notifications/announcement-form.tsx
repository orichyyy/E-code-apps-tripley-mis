import { useForm } from "@tanstack/react-form";
import type { CreateAnnouncementRequest, UpdateAnnouncementRequest } from "@web-admin-base/contracts";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Announcement } from "./announcement-api";
import {
  announcementFormSchema,
  defaultAnnouncementFormValues,
  toAnnouncementApiInput,
  type AnnouncementFormMode
} from "./announcement-model";

type AnnouncementFormProps = {
  busy: boolean;
  initialRecord?: Announcement;
  mode: AnnouncementFormMode;
  onCancel: () => void;
  onSubmit: (input: CreateAnnouncementRequest | UpdateAnnouncementRequest) => void;
};

export function AnnouncementForm({ busy, initialRecord, mode, onCancel, onSubmit }: AnnouncementFormProps) {
  const initialValues = initialRecord
    ? {
        title: initialRecord.title,
        content: initialRecord.content,
        scopeType: initialRecord.scopeType
      }
    : defaultAnnouncementFormValues;
  const form = useForm({
    defaultValues: initialValues,
    validators: { onSubmit: announcementFormSchema },
    onSubmit: ({ value }) => onSubmit(toAnnouncementApiInput(value, mode))
  });

  return (
    <section className="rounded-lg border bg-card p-4 shadow-sm">
      <h3 className="text-sm font-semibold">{mode === "create" ? "Create announcement" : "Edit announcement"}</h3>
      <form
        className="mt-4 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.Field
          name="title"
          children={(field) => (
            <label className="block text-sm font-medium">
              Title
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
          name="scopeType"
          children={(field) => (
            <label className="block text-sm font-medium">
              Scope
              <select
                className="mt-2 h-10 w-full rounded-md border bg-background px-3"
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value as "system" | "organization")}
                value={field.state.value}
              >
                <option value="system">System</option>
                <option value="organization">Organization</option>
              </select>
            </label>
          )}
        />
        <form.Field
          name="content"
          children={(field) => (
            <label className="block text-sm font-medium">
              Content
              <textarea
                className="mt-2 min-h-40 w-full rounded-md border bg-background px-3 py-2"
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
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
