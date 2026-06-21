"use client";

import type { BuilderDraft, BuilderDraftAction } from "./builder-draft-state";

export type WizardCanvasProps = {
  readonly draft: BuilderDraft;
  readonly duplicateFieldIds: readonly string[];
  readonly dispatch: (action: BuilderDraftAction) => void;
};

export function WizardCanvas({ draft, duplicateFieldIds, dispatch }: WizardCanvasProps) {
  const duplicateSet = new Set(duplicateFieldIds);

  return (
    <section
      className="space-y-4 rounded-lg border border-border p-4"
      data-platform-wizard-canvas
    >
      <div className="flex flex-wrap gap-2">
        {draft.payload.wizard.roots.map((stepId) => (
          <button
            key={stepId}
            type="button"
            data-step-id={stepId}
            className={
              draft.activeStepId === stepId
                ? "rounded-md bg-muted px-3 py-1.5 text-sm font-medium"
                : "rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted/60"
            }
            onClick={() => dispatch({ type: "setActiveStep", stepId })}
          >
            {stepId}
          </button>
        ))}
      </div>

      <ul className="space-y-2">
        {draft.payload.fieldRegistry.fields
          .filter((field) => field.stepId === draft.activeStepId)
          .map((field) => (
            <li
              key={field.id}
              data-field-row={field.id}
              className={
                draft.selectedFieldId === field.id
                  ? "rounded-md border border-primary bg-primary/5 p-3"
                  : "rounded-md border border-border p-3"
              }
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  className="text-left text-sm font-medium"
                  onClick={() => dispatch({ type: "selectField", fieldId: field.id })}
                >
                  {field.id}
                  {duplicateSet.has(field.id) ? (
                    <span className="ml-2 text-xs text-destructive">duplicate id</span>
                  ) : null}
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => dispatch({ type: "moveField", fieldId: field.id, direction: "up" })}
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => dispatch({ type: "moveField", fieldId: field.id, direction: "down" })}
                  >
                    Down
                  </button>
                  <button
                    type="button"
                    className="text-xs text-destructive hover:underline"
                    onClick={() => dispatch({ type: "removeField", fieldId: field.id })}
                  >
                    Remove
                  </button>
                </div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {field.kind} · {field.canonicalPath}
                {field.required ? " · required" : ""}
              </p>
            </li>
          ))}
      </ul>
    </section>
  );
}
