"use client";

import type { WorkspaceFieldKind } from "@app-tour/workspace-sdk";
import { Checkbox } from "@app-tour/ui-primitives/checkbox";
import { Input } from "@app-tour/ui-primitives/input";

import type { BuilderDraft, BuilderDraftAction } from "./builder-draft-state";

const FIELD_KINDS: readonly WorkspaceFieldKind[] = [
  "text",
  "number",
  "boolean",
  "enum",
  "date",
  "composite",
];

export type FieldInspectorProps = {
  readonly draft: BuilderDraft;
  readonly dispatch: (action: BuilderDraftAction) => void;
};

export function FieldInspector({ draft, dispatch }: FieldInspectorProps) {
  const selected = draft.payload.fieldRegistry.fields.find(
    (field) => field.id === draft.selectedFieldId
  );

  if (!selected) {
    return (
      <aside className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        Select a field to edit.
      </aside>
    );
  }

  return (
    <aside className="space-y-3 rounded-lg border border-border p-4" data-platform-field-inspector>
      <h2 className="text-sm font-semibold">Field inspector</h2>
      <label className="block space-y-1 text-sm">
        <span>Id</span>
        <Input
          className="w-full rounded-md border border-border px-2 py-1"
          value={selected.id}
          onChange={(event) =>
            dispatch({
              type: "updateField",
              fieldId: selected.id,
              patch: { id: event.target.value },
            })
          }
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span>Canonical path</span>
        <Input
          className="w-full rounded-md border border-border px-2 py-1"
          value={selected.canonicalPath}
          onChange={(event) =>
            dispatch({
              type: "updateField",
              fieldId: selected.id,
              patch: { canonicalPath: event.target.value },
            })
          }
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span>Step</span>
        <select
          className="w-full rounded-md border border-border px-2 py-1"
          value={selected.stepId}
          onChange={(event) =>
            dispatch({
              type: "updateField",
              fieldId: selected.id,
              patch: { stepId: event.target.value },
            })
          }
        >
          {draft.payload.wizard.roots.map((stepId) => (
            <option key={stepId} value={stepId}>
              {stepId}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1 text-sm">
        <span>Kind</span>
        <select
          className="w-full rounded-md border border-border px-2 py-1"
          value={selected.kind}
          onChange={(event) =>
            dispatch({
              type: "updateField",
              fieldId: selected.id,
              patch: { kind: event.target.value as WorkspaceFieldKind },
            })
          }
        >
          {FIELD_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {kind}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={selected.required}
          onChange={(event) =>
            dispatch({
              type: "updateField",
              fieldId: selected.id,
              patch: { required: event.target.checked },
            })
          }
        />
        Required
      </label>
    </aside>
  );
}
