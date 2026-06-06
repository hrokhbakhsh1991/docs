"use client";

import type { RenderFieldPlan } from "@app-tour/platform-core";
import type { WorkspaceFieldKind } from "@app-tour/workspace-sdk/plugin-types";
import { Checkbox } from "@app-tour/ui-primitives/checkbox";
import { Input } from "@app-tour/ui-primitives/input";
import { Select, type SelectOption } from "@app-tour/ui-primitives/select";
import React, { type ReactNode } from "react";

/** Kinds wired to ui-primitives subpaths in the Phase 3 shell. */
export const SUPPORTED_WIZARD_FIELD_KINDS = [
  "text",
  "enum",
  "boolean",
  "number",
  "date",
] as const satisfies readonly WorkspaceFieldKind[];

/** Composite widgets resolve in workspace plugins (phase 6). */
export const DEFERRED_WIZARD_FIELD_KINDS = [
  "composite",
] as const satisfies readonly WorkspaceFieldKind[];

type WizardFieldRendererProps = {
  readonly field: RenderFieldPlan;
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly label: string;
};

export function parseEnumOptions(field: RenderFieldPlan): readonly SelectOption[] {
  const raw = field.uiHints?.enumOptions;
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((entry) => {
      const value = String(entry);
      return { value, label: value };
    });
  } catch {
    return [];
  }
}

function renderTextField({ field, value, onChange, label }: WizardFieldRendererProps): ReactNode {
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

function renderEnumField({ field, value, onChange, label }: WizardFieldRendererProps): ReactNode {
  const options = parseEnumOptions(field);
  return (
    <label>
      <span>{label}</span>
      <Select
        name={field.fieldId}
        aria-label={label}
        options={options}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={field.required}
        aria-required={field.required || undefined}
        placeholder={field.uiHints?.placeholder ?? "Select…"}
      />
    </label>
  );
}

function renderBooleanField({
  field,
  value,
  onChange,
  label,
}: WizardFieldRendererProps): ReactNode {
  const checked = value === "true";
  return (
    <label>
      <Checkbox
        name={field.fieldId}
        aria-label={label}
        checked={checked}
        onChange={(event) => onChange(event.target.checked ? "true" : "false")}
        required={field.required}
        aria-required={field.required || undefined}
      />
      <span>{label}</span>
    </label>
  );
}

function renderNumberField({ field, value, onChange, label }: WizardFieldRendererProps): ReactNode {
  return (
    <label>
      <span>{label}</span>
      <Input
        name={field.fieldId}
        type="number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={field.required}
        aria-required={field.required || undefined}
        placeholder={field.uiHints?.placeholder}
      />
    </label>
  );
}

function renderDateField({ field, value, onChange, label }: WizardFieldRendererProps): ReactNode {
  return (
    <label>
      <span>{label}</span>
      <Input
        name={field.fieldId}
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={field.required}
        aria-required={field.required || undefined}
      />
    </label>
  );
}

/** Kind → renderer registry (Phase 3 shell — extend when new primitives ship). */
export const WIZARD_FIELD_RENDERERS: Readonly<
  Partial<Record<WorkspaceFieldKind, (props: WizardFieldRendererProps) => ReactNode>>
> = {
  text: renderTextField,
  enum: renderEnumField,
  boolean: renderBooleanField,
  number: renderNumberField,
  date: renderDateField,
};

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
        Supported kinds: {SUPPORTED_WIZARD_FIELD_KINDS.join(", ")}. Deferred:{" "}
        {DEFERRED_WIZARD_FIELD_KINDS.join(", ")}.
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
  const render = WIZARD_FIELD_RENDERERS[field.kind];
  if (render) {
    return render({ field, value, onChange, label });
  }

  return <UnsupportedWizardField field={field} value={value} />;
}
