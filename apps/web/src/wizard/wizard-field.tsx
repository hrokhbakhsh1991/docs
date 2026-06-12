"use client";

import type { RenderFieldPlan } from "@app-tour/platform-core";
import type { WorkspaceFieldKind } from "@app-tour/workspace-sdk/plugin-types";
import { wizardFieldPathAttributes } from "@app-tour/wizard-navigation";
import { Checkbox } from "@app-tour/ui-primitives/checkbox";
import { Input } from "@app-tour/ui-primitives/input";
import { Select, type SelectOption } from "@app-tour/ui-primitives/select";
import { useTranslations } from "next-intl";
import React, { type ReactNode } from "react";

import { LocalizedDatePicker } from "@/components/i18n/localized-date-picker";
import { PrimitiveLocalizedNumericInput } from "@/components/i18n/localized-numeric-input";
import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import { resolveWizardTemplateFieldLabel } from "@/tours/wizard-template-field-labels";

import { resolveWizardCompositeSurface } from "./wizard-composite-surface-registry";

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

function fieldMarkerProps(field: RenderFieldPlan) {
  return wizardFieldPathAttributes(field.canonicalPath, field.fieldId);
}

type WizardFieldRendererProps = {
  readonly field: RenderFieldPlan;
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly label: string;
  readonly dataTestId?: string;
  readonly selectPlaceholder: string;
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

function renderTextField({
  field,
  value,
  onChange,
  label,
  dataTestId,
}: WizardFieldRendererProps): ReactNode {
  return (
    <label {...fieldMarkerProps(field)}>
      <span>{label}</span>
      <Input
        name={field.fieldId}
        data-testid={dataTestId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={field.required}
        aria-required={field.required || undefined}
        placeholder={field.uiHints?.placeholder}
      />
    </label>
  );
}

function renderEnumField({
  field,
  value,
  onChange,
  label,
  selectPlaceholder,
}: WizardFieldRendererProps): ReactNode {
  const options = parseEnumOptions(field);
  return (
    <label {...fieldMarkerProps(field)}>
      <span>{label}</span>
      <Select
        name={field.fieldId}
        aria-label={label}
        options={options}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={field.required}
        aria-required={field.required || undefined}
        placeholder={field.uiHints?.placeholder ?? selectPlaceholder}
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
    <label {...fieldMarkerProps(field)}>
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
    <label {...fieldMarkerProps(field)}>
      <span>{label}</span>
      <PrimitiveLocalizedNumericInput
        name={field.fieldId}
        value={value}
        onChange={onChange}
        mode="decimal"
        required={field.required}
        aria-required={field.required || undefined}
        placeholder={field.uiHints?.placeholder}
      />
    </label>
  );
}

function renderDateField({ field, value, onChange, label }: WizardFieldRendererProps): ReactNode {
  return (
    <label {...fieldMarkerProps(field)}>
      <span>{label}</span>
      <div data-wizard-date-picker>
        <LocalizedDatePicker
          value={value}
          onChange={onChange}
          required={field.required}
          aria-label={label}
        />
      </div>
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
  label,
  unsupportedEditor,
  readOnlyLabel,
  emptyValue,
}: {
  readonly field: RenderFieldPlan;
  readonly value: string;
  readonly label: string;
  readonly unsupportedEditor: string;
  readonly readOnlyLabel: string;
  readonly emptyValue: string;
}) {
  return (
    <div
      {...fieldMarkerProps(field)}
      data-unsupported-kind={field.kind}
      role="status"
      aria-live="polite"
    >
      <p>
        <strong>{label}</strong> {unsupportedEditor}
      </p>
      <output aria-label={`${label} (${readOnlyLabel})`}>{value || emptyValue}</output>
    </div>
  );
}

export function WizardField({
  field,
  value,
  onChange,
  dataTestId,
  pluginId,
  draft,
  onDraftChange,
  wizardSessionId,
  workspaceFormProfile,
  compositeSurfaceId,
  fieldLabelSurfaceId,
}: {
  readonly field: RenderFieldPlan;
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly dataTestId?: string;
  readonly pluginId?: string;
  readonly draft?: TourWizardDraft;
  readonly onDraftChange?: (draft: TourWizardDraft) => void;
  readonly wizardSessionId?: string;
  readonly workspaceFormProfile?: string;
  readonly compositeSurfaceId?: string;
  readonly fieldLabelSurfaceId?: string;
}) {
  const tDenali = useTranslations("denali");
  const tField = useTranslations("wizard.field");
  const labelSurface = resolveWizardCompositeSurface(fieldLabelSurfaceId);
  const label =
    labelSurface != null
      ? labelSurface.resolveFieldLabel((key) => tDenali(key), field.canonicalPath)
      : resolveWizardTemplateFieldLabel(field.canonicalPath, pluginId);

  if (field.hidden) {
    return null;
  }

  const compositeId =
    field.uiHints?.compositeId ??
    (field.fieldId.startsWith("denali.") ? field.fieldId : undefined);
  if (compositeId != null && compositeId.length > 0 && draft !== undefined && onDraftChange) {
    const compositeSurface = resolveWizardCompositeSurface(compositeSurfaceId);
    if (compositeSurface != null) {
      return compositeSurface.renderCompositeField({
        compositeId,
        field,
        draft,
        onDraftChange,
        wizardSessionId,
        workspaceFormProfile,
      });
    }
  }

  const render = WIZARD_FIELD_RENDERERS[field.kind];
  if (render) {
    return render({
      field,
      value,
      onChange,
      label,
      dataTestId,
      selectPlaceholder: tField("selectPlaceholder"),
    });
  }

  return (
    <UnsupportedWizardField
      field={field}
      value={value}
      label={label}
      unsupportedEditor={tField("unsupportedEditor")}
      readOnlyLabel={tField("readOnly")}
      emptyValue={tField("emptyValue")}
    />
  );
}
