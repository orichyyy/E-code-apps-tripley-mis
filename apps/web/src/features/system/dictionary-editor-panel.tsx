import type {
  CreateDictionaryItemRequest,
  CreateDictionaryTypeRequest
} from "@web-admin-base/contracts";

import { DictionaryItemForm, DictionaryTypeForm } from "./dictionary-forms";
import type { DictionaryItem, DictionaryType } from "./system-management-api";

type EditorState =
  | { kind: "type-create" }
  | { kind: "type-edit"; record: DictionaryType }
  | { kind: "item-create" }
  | { kind: "item-edit"; record: DictionaryItem }
  | null;

type DictionaryEditorPanelProps = {
  busy: boolean;
  editor: EditorState;
  error: boolean;
  onCancel: () => void;
  onCreateItem: (input: CreateDictionaryItemRequest) => void;
  onCreateType: (input: CreateDictionaryTypeRequest) => void;
  onUpdateItem: (record: DictionaryItem, input: Partial<CreateDictionaryItemRequest>) => void;
  onUpdateType: (record: DictionaryType, input: Partial<CreateDictionaryTypeRequest>) => void;
  selectedType: DictionaryType | null;
};

export function DictionaryEditorPanel({
  busy,
  editor,
  error,
  onCancel,
  onCreateItem,
  onCreateType,
  onUpdateItem,
  onUpdateType,
  selectedType
}: DictionaryEditorPanelProps) {
  return (
    <aside className="flex flex-col gap-4">
      {editor?.kind === "type-create" ? (
        <DictionaryTypeForm busy={busy} mode="create" onCancel={onCancel} onSubmit={onCreateType} />
      ) : null}
      {editor?.kind === "type-edit" ? (
        <DictionaryTypeForm
          busy={busy}
          initialRecord={editor.record}
          key={editor.record.id}
          mode="edit"
          onCancel={onCancel}
          onSubmit={(input) => onUpdateType(editor.record, input)}
        />
      ) : null}
      {editor?.kind === "item-create" ? (
        <DictionaryItemForm busy={busy} mode="create" onCancel={onCancel} onSubmit={onCreateItem} />
      ) : null}
      {editor?.kind === "item-edit" ? (
        <DictionaryItemForm
          busy={busy}
          initialRecord={editor.record}
          key={editor.record.id}
          mode="edit"
          onCancel={onCancel}
          onSubmit={(input) => onUpdateItem(editor.record, input)}
        />
      ) : null}
      {!editor ? <DictionaryBoundary selectedType={selectedType} /> : null}
      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          Dictionary mutation failed.
        </div>
      ) : null}
    </aside>
  );
}

function DictionaryBoundary({ selectedType }: { selectedType: DictionaryType | null }) {
  return (
    <section className="rounded-lg border bg-card p-4 text-sm shadow-sm">
      <h3 className="font-semibold">Dictionary boundary</h3>
      <p className="mt-2 text-muted-foreground">
        Dictionaries are global in version 1. Organization-level overrides and ad hoc i18n key creation remain reserved.
      </p>
      {selectedType ? (
        <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div>
            <dt className="text-muted-foreground">Selected type</dt>
            <dd className="mt-1 font-medium">{selectedType.code}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd className="mt-1 font-medium">{selectedType.status}</dd>
          </div>
        </dl>
      ) : null}
    </section>
  );
}
