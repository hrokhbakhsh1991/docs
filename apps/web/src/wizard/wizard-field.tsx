"use client";

import type { RenderFieldPlan } from "@app-tour/platform-core";
import { Input } from "@app-tour/ui-primitives/input";

function UnsupportedWizardField({
  field,
  value,
}: {
  readonly field: RenderFieldPlan;
  readonly value: string;
}) {
  const label = field.canonicalPath;

  return (
    <div
      data-unsupported-kind={field.kind}
      data-field-id={field.fieldId}
      role="status"
      aria-live="polite"
    >
      <p>
        <strong>{label}</strong> — not supported in Phase 3 shell ({field.kind})
      </p>
      <output aria-label={`${label} (read-only)`}>{value || "—"}</output>
      <p data-unsupported-hint>
        This field is read-only until Select/Checkbox primitives ship. Form state is unchanged.
      </p>
    </div>
  );
}

export function WizardField({
  field,
  value,
  onChange,
}: {
  readonly field: RenderFieldPlan;
  readonly value: string;
  readonly onChange: (next: string) => void;
}) {
  if (field.hidden) {
    return null;
  }

  const label = field.canonicalPath;

  if (field.kind === "text") {
    return (
      <label>
        <span>{label}</span>
        <Input
          name={field.fieldId}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={field.required}
          aria-required={field.required || undefined}
          placeholder={field.uiHints?.placeholder}
        />
      </label>
    );
  }

  return <UnsupportedWizardField field={field} value={value} />;
}
