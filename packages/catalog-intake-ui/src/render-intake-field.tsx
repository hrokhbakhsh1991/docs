import { Input } from "@app-tour/ui-primitives/input";
import type { IntakeField } from "@app-tour/workspace-sdk";
import type { ChangeEvent, ReactNode } from "react";

export type RenderIntakeFieldProps = {
  readonly field: IntakeField;
  readonly value: string;
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly describedBy?: string;
  readonly invalid?: boolean;
};

export function RenderIntakeField({
  field,
  value,
  label,
  onChange,
  describedBy,
  invalid = false,
}: RenderIntakeFieldProps) {
  const inputId = `schema-intake-${field.id}`;
  const requiredMarker = field.required ? <span aria-hidden="true"> *</span> : null;
  const commonInputProps = {
    id: inputId,
    name: field.id,
    value,
    onChange: (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value),
    required: field.required,
    "aria-invalid": invalid,
    "aria-describedby": describedBy,
    "data-intake-field": field.id,
    pattern: field.rules?.pattern,
    minLength: field.rules?.minLength,
    maxLength: field.rules?.maxLength,
  };

  if (field.type === "boolean") {
    return (
      <label htmlFor={inputId} data-intake-field={field.id}>
        <input
          id={inputId}
          name={field.id}
          type="checkbox"
          checked={value === "true"}
          onChange={(event) => onChange(event.target.checked ? "true" : "false")}
          required={field.required}
          aria-invalid={invalid}
          aria-describedby={describedBy}
        />
        <span>
          {label}
          {requiredMarker}
        </span>
      </label>
    );
  }

  let control: ReactNode;
  if (field.type === "number" || field.widget === "localized-digits") {
    control = <Input {...commonInputProps} type="number" inputMode="numeric" />;
  } else if (field.type === "date") {
    control = <Input {...commonInputProps} type="date" />;
  } else if (field.type === "email") {
    control = <Input {...commonInputProps} type="email" autoComplete="email" />;
  } else if (field.widget === "numeric-text") {
    control = <Input {...commonInputProps} type="text" inputMode="numeric" autoComplete="off" />;
  } else {
    control = (
      <Input
        {...commonInputProps}
        type="text"
        autoComplete={field.id === "fullName" ? "name" : "off"}
      />
    );
  }

  return (
    <>
      <label htmlFor={inputId}>
        {label}
        {requiredMarker}
      </label>
      {control}
    </>
  );
}
