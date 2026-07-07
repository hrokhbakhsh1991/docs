"use client";

import { BUILDER_MAX_SIMPLE_RULES, type BuilderDraft, type BuilderDraftAction } from "./builder-draft-state";

export type RuleMatrixEditorProps = {
  readonly draft: BuilderDraft;
  readonly dispatch: (action: BuilderDraftAction) => void;
};

export function RuleMatrixEditor({ draft, dispatch }: RuleMatrixEditorProps) {
  const atCap = draft.simpleRules.length >= BUILDER_MAX_SIMPLE_RULES;

  return (
    <section
      className="space-y-3 rounded-lg border border-border p-4"
      data-platform-rule-matrix
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Rules (v1)</h2>
        <button
          type="button"
          className="rounded-md border border-border px-3 py-1 text-sm disabled:opacity-50"
          disabled={atCap}
          data-rule-add
          onClick={() =>
            dispatch({
              type: "addSimpleRule",
              rule: {
                id: `rule.${draft.simpleRules.length + 1}`,
                when: {
                  fieldId: draft.payload.fieldRegistry.fields[0]?.id ?? "",
                  operator: "eq",
                  value: "",
                },
                effect: {
                  type: "hidden",
                  targetFieldId: draft.payload.fieldRegistry.fields[0]?.id ?? "",
                },
              },
            })
          }
        >
          Add rule
        </button>
      </div>

      <ul className="space-y-2">
        {draft.simpleRules.map((rule) => (
          <li key={rule.id} className="rounded-md border border-border p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{rule.id}</span>
              <button
                type="button"
                className="text-xs text-destructive hover:underline"
                onClick={() => dispatch({ type: "removeSimpleRule", ruleId: rule.id })}
              >
                Remove
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              when {rule.when.fieldId} {rule.when.operator} {rule.when.value || "∅"} →{" "}
              {rule.effect.type} {rule.effect.targetFieldId}
            </p>
          </li>
        ))}
      </ul>

      {atCap ? (
        <p className="text-xs text-muted-foreground">Maximum {BUILDER_MAX_SIMPLE_RULES} rules.</p>
      ) : null}
    </section>
  );
}
