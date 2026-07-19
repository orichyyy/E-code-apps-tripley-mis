import { useForm } from "@tanstack/react-form";
import type {
  CreateAnnouncementRequest,
  UpdateAnnouncementRequest,
} from "@web-admin-base/contracts";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { translate } from "@/i18n/messages";
import { useLayoutStore } from "@/stores/layout.store";
import type { Announcement, AnnouncementOrganization } from "./announcement-api";
import {
  announcementFormSchema,
  defaultAnnouncementFormValues,
  toAnnouncementApiInput,
  toLocalDateTime,
  type AnnouncementFormMode,
} from "./announcement-model";

type AnnouncementFormProps = {
  busy: boolean;
  initialRecord?: Announcement;
  mode: AnnouncementFormMode;
  organizations: AnnouncementOrganization[];
  onCancel: () => void;
  onSubmit: (input: CreateAnnouncementRequest | UpdateAnnouncementRequest) => void;
};

export function AnnouncementForm(props: AnnouncementFormProps) {
  const { busy, initialRecord, mode, organizations, onCancel, onSubmit } = props;
  const language = useLayoutStore((state) => state.language);
  const form = useForm({
    defaultValues: initialRecord
      ? {
          title: initialRecord.title,
          content: initialRecord.content,
          scopeType: initialRecord.scopeType,
          targetOrganizationIds: initialRecord.targetOrganizationIds,
          expiresAt: toLocalDateTime(initialRecord.expiresAt),
        }
      : defaultAnnouncementFormValues,
    validators: { onSubmit: announcementFormSchema },
    onSubmit: ({ value }) => onSubmit(toAnnouncementApiInput(value, mode)),
  });

  return (
    <section className="rounded-lg border bg-card p-4 shadow-sm">
      <h3 className="text-sm font-semibold">
        {translate(language, mode === "create" ? "announcements.create" : "announcements.edit")}
      </h3>
      <form className="mt-4 space-y-4" onSubmit={submitForm(form.handleSubmit)}>
        <form.Field
          name="title"
          children={(field) => (
            <TextField field={field} label={translate(language, "announcements.title")} />
          )}
        />
        <form.Field
          name="scopeType"
          children={(field) => (
            <label className="block text-sm font-medium">
              {translate(language, "announcements.scope")}
              <select
                className="mt-2 h-10 w-full rounded-md border bg-background px-3"
                onBlur={field.handleBlur}
                onChange={(event) => {
                  const scope = event.target.value as "system" | "organization";
                  field.handleChange(scope);
                  if (scope === "system") form.setFieldValue("targetOrganizationIds", []);
                }}
                value={field.state.value}
              >
                <option value="system">{translate(language, "announcements.system")}</option>
                <option value="organization">
                  {translate(language, "announcements.organization")}
                </option>
              </select>
            </label>
          )}
        />
        <form.Subscribe
          selector={(state) => state.values.scopeType}
          children={(scopeType) =>
            scopeType === "organization" ? (
              <form.Field
                name="targetOrganizationIds"
                children={(field) => (
                  <OrganizationTargetTree
                    organizations={organizations}
                    selectedIds={field.state.value}
                    title={translate(language, "announcements.targets")}
                    onChange={field.handleChange}
                  />
                )}
              />
            ) : null
          }
        />
        <form.Field
          name="expiresAt"
          children={(field) => (
            <label className="block text-sm font-medium">
              {translate(language, "announcements.expiresAt")}
              <input
                className="mt-2 h-10 w-full rounded-md border bg-background px-3"
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                type="datetime-local"
                value={field.state.value}
              />
            </label>
          )}
        />
        <form.Field
          name="content"
          children={(field) => (
            <label className="block text-sm font-medium">
              {translate(language, "announcements.content")}
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
            {translate(language, "actions.cancel")}
          </Button>
          <Button disabled={busy} type="submit">
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {translate(language, "actions.save")}
          </Button>
        </div>
      </form>
    </section>
  );
}

function OrganizationTargetTree({
  organizations,
  selectedIds,
  title,
  onChange,
}: {
  organizations: AnnouncementOrganization[];
  selectedIds: string[];
  title: string;
  onChange: (ids: string[]) => void;
}) {
  return (
    <fieldset className="rounded-md border bg-background p-3">
      <legend className="px-1 text-sm font-medium">{title}</legend>
      <div className="max-h-52 space-y-1 overflow-y-auto">
        {organizations.map((organization) => (
          <OrganizationTargetNode
            ancestorSelected={false}
            key={organization.id}
            organization={organization}
            selectedIds={selectedIds}
            onChange={onChange}
          />
        ))}
      </div>
    </fieldset>
  );
}

function OrganizationTargetNode({
  ancestorSelected,
  organization,
  selectedIds,
  onChange,
}: {
  ancestorSelected: boolean;
  organization: AnnouncementOrganization;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const checked = selectedIds.includes(organization.id);
  const disabled = ancestorSelected || organization.status === "disabled";
  const descendants = descendantIds(organization);
  const toggle = () => {
    if (checked) return onChange(selectedIds.filter((id) => id !== organization.id));
    onChange([...selectedIds.filter((id) => !descendants.has(id)), organization.id]);
  };
  return (
    <div>
      <label
        className="flex h-8 items-center gap-2 rounded px-2 text-sm hover:bg-muted/60"
        style={{ paddingLeft: `${Math.max(0, organization.level - 1) * 16 + 8}px` }}
      >
        <input checked={checked} disabled={disabled} onChange={toggle} type="checkbox" />
        <span>{organization.name}</span>
        <span className="text-xs text-muted-foreground">{organization.code}</span>
      </label>
      {organization.children.map((child) => (
        <OrganizationTargetNode
          ancestorSelected={ancestorSelected || checked}
          key={child.id}
          organization={child}
          selectedIds={selectedIds}
          onChange={onChange}
        />
      ))}
    </div>
  );
}

function descendantIds(organization: AnnouncementOrganization): Set<string> {
  const result = new Set<string>();
  const visit = (node: AnnouncementOrganization) => {
    node.children.forEach((child) => {
      result.add(child.id);
      visit(child);
    });
  };
  visit(organization);
  return result;
}

function TextField({ field, label }: { field: TextFormField; label: string }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input
        className="mt-2 h-10 w-full rounded-md border bg-background px-3"
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
        value={field.state.value}
      />
    </label>
  );
}

type TextFormField = {
  state: { value: string };
  handleBlur: () => void;
  handleChange: (value: string) => void;
};

function submitForm(handleSubmit: () => Promise<void>) {
  return (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleSubmit();
  };
}
