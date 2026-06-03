"use client";

import type { RenderFieldPlan } from "@app-tour/platform-core";
import { Input } from "@app-tour/ui-primitives/input";

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

  return (
    <p data-unsupported-kind={field.kind}>
      Unsupported field kind: {field.kind}
    </p>
  );
}
