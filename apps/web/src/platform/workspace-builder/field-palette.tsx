"use client";

import {
  BUILDER_COMPOSITE_PALETTE,
  BUILDER_PRIMITIVE_PALETTE,
  type BuilderDraft,
  type BuilderDraftAction,
} from "./builder-draft-state";

export type FieldPaletteProps = {
  readonly draft: BuilderDraft;
  readonly dispatch: (action: BuilderDraftAction) => void;
};

export function FieldPalette({ draft, dispatch }: FieldPaletteProps) {
  return (
    <aside
      className="space-y-4 rounded-lg border border-border p-4"
      data-platform-field-palette
    >
      <div>
        <h2 className="text-sm font-semibold">Primitives</h2>
        <div className="mt-2 flex flex-col gap-2">
          {BUILDER_PRIMITIVE_PALETTE.map((item) => (
            <button
              key={item.kind}
              type="button"
              data-palette-item={item.kind}
              className="rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-muted"
              onClick={() => dispatch({ type: "addPrimitiveField", kind: item.kind })}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold">Platform composites</h2>
        <div className="mt-2 flex flex-col gap-2">
          {BUILDER_COMPOSITE_PALETTE.map((item) => (
            <button
              key={item.id}
              type="button"
              data-palette-item={item.id}
              className="rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-muted"
              onClick={() => dispatch({ type: "addCompositeField", rendererId: item.id })}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Active step: <span className="font-medium">{draft.activeStepId}</span>
      </p>
    </aside>
  );
}
