"use client";

import { LocalizedDatePicker } from "@app-tour/localized-calendar";
import type { IntakeField } from "@app-tour/workspace-sdk";

export type DenaliIntakeBirthDateFieldProps = {
  readonly field: IntakeField;
  readonly value: string;
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly idPrefix: string;
  readonly describedBy?: string;
  readonly invalid?: boolean;
};

export function DenaliIntakeBirthDateField({
  field,
  value,
  label,
  onChange,
  idPrefix,
  describedBy,
  invalid = false,
}: DenaliIntakeBirthDateFieldProps) {
  const inputId = `${idPrefix}-${field.id}`;
  const requiredMarker = field.required ? <span aria-hidden="true"> *</span> : null;

  return (
    <>
      <label htmlFor={inputId}>
        {label}
        {requiredMarker}
      </label>
      <LocalizedDatePicker
        id={inputId}
        name={field.id}
        value={value}
        onChange={onChange}
        required={field.required}
        invalid={invalid}
        aria-describedby={describedBy}
        triggerDataAttributes={{ "data-intake-field": field.id }}
        collisionSelectors={["[data-action='intake-submit']"]}
        data-testid={`${idPrefix}-birth-date-picker`}
      />
    </>
  );
}
