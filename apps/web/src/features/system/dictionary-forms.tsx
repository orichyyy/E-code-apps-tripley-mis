import { useForm } from "@tanstack/react-form";
import {
  createDictionaryItemRequestSchema,
  createDictionaryTypeRequestSchema,
  type CreateDictionaryItemRequest,
  type CreateDictionaryTypeRequest
} from "@web-admin-base/contracts";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { DictionaryItem, DictionaryType } from "./system-management-api";

type DictionaryTypeFormProps = {
  busy: boolean;
  initialRecord?: DictionaryType;
  mode: "create" | "edit";
  onCancel: () => void;
  onSubmit: (input: CreateDictionaryTypeRequest) => void;
};

type DictionaryItemFormProps = {
  busy: boolean;
  initialRecord?: DictionaryItem;
  mode: "create" | "edit";
  onCancel: () => void;
  onSubmit: (input: CreateDictionaryItemRequest) => void;
};

export function DictionaryTypeForm({ busy, initialRecord, mode, onCancel, onSubmit }: DictionaryTypeFormProps) {
  const form = useForm({
    defaultValues: {
      code: initialRecord?.code ?? "",
      name: initialRecord?.name ?? "",
      description: initialRecord?.description ?? "",
      status: initialRecord?.status === "disabled" ? "disabled" : "enabled"
    },
    onSubmit: ({ value }) => onSubmit(createDictionaryTypeRequestSchema.parse({
      code: value.code,
      name: value.name,
      description: value.description || null,
      status: value.status
    }))
  });

  return (
    <form className="rounded-lg border bg-card p-4 text-sm shadow-sm" onSubmit={submitForm(form.handleSubmit)}>
      <h3 className="font-semibold">{mode === "create" ? "Create dictionary type" : "Edit dictionary type"}</h3>
      <div className="mt-4 flex flex-col gap-3">
        <form.Field name="code">
          {(field) => <TextInput disabled={busy} field={field} label="Code" />}
        </form.Field>
        <form.Field name="name">
          {(field) => <TextInput disabled={busy} field={field} label="Name" />}
        </form.Field>
        <form.Field name="description">
          {(field) => <TextInput disabled={busy} field={field} label="Description" />}
        </form.Field>
        <form.Field name="status">
          {(field) => <StatusInput disabled={busy} field={field} />}
        </form.Field>
      </div>
      <FormActions busy={busy} onCancel={onCancel} />
    </form>
  );
}

export function DictionaryItemForm({ busy, initialRecord, mode, onCancel, onSubmit }: DictionaryItemFormProps) {
  const form = useForm({
    defaultValues: {
      itemValue: initialRecord?.itemValue ?? "",
      labelI18nKey: initialRecord?.labelI18nKey ?? "",
      sortOrder: String(initialRecord?.sortOrder ?? 0),
      status: initialRecord?.status === "disabled" ? "disabled" : "enabled"
    },
    onSubmit: ({ value }) => onSubmit(createDictionaryItemRequestSchema.parse({
      itemValue: value.itemValue,
      labelI18nKey: value.labelI18nKey,
      sortOrder: Number(value.sortOrder),
      status: value.status
    }))
  });

  return (
    <form className="rounded-lg border bg-card p-4 text-sm shadow-sm" onSubmit={submitForm(form.handleSubmit)}>
      <h3 className="font-semibold">{mode === "create" ? "Create dictionary item" : "Edit dictionary item"}</h3>
      <div className="mt-4 flex flex-col gap-3">
        <form.Field name="itemValue">
          {(field) => <TextInput disabled={busy} field={field} label="Item value" />}
        </form.Field>
        <form.Field name="labelI18nKey">
          {(field) => <TextInput disabled={busy} field={field} label="Label i18n key" />}
        </form.Field>
        <form.Field name="sortOrder">
          {(field) => <TextInput disabled={busy} field={field} label="Sort order" type="number" />}
        </form.Field>
        <form.Field name="status">
          {(field) => <StatusInput disabled={busy} field={field} />}
        </form.Field>
      </div>
      <FormActions busy={busy} onCancel={onCancel} />
    </form>
  );
}

function TextInput({
  disabled,
  field,
  label,
  type = "text"
}: {
  disabled: boolean;
  field: {
    handleBlur: () => void;
    handleChange: (value: string) => void;
    state: { value: string };
  };
  label: string;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-medium">{label}</span>
      <input
        className="rounded-md border bg-background px-3 py-2 outline-none"
        disabled={disabled}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
        type={type}
        value={field.state.value}
      />
    </label>
  );
}

function StatusInput({
  disabled,
  field
}: {
  disabled: boolean;
  field: {
    handleChange: (value: "enabled" | "disabled") => void;
    state: { value: string };
  };
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-medium">Status</span>
      <select
        className="rounded-md border bg-background px-3 py-2 outline-none"
        disabled={disabled}
        onChange={(event) => field.handleChange(event.target.value === "disabled" ? "disabled" : "enabled")}
        value={field.state.value}
      >
        <option value="enabled">enabled</option>
        <option value="disabled">disabled</option>
      </select>
    </label>
  );
}

function FormActions({ busy, onCancel }: { busy: boolean; onCancel: () => void }) {
  return (
    <div className="mt-4 flex justify-end gap-2">
      <Button disabled={busy} onClick={onCancel} size="sm" type="button" variant="ghost">
        Cancel
      </Button>
      <Button disabled={busy} size="sm" type="submit">
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        Save
      </Button>
    </div>
  );
}

function submitForm(handler: () => void | Promise<void>) {
  return (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    void handler();
  };
}
