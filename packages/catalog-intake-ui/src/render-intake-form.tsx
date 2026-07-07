import type { IntakeField, IntakeSchema } from "@app-tour/workspace-sdk";

import { RenderIntakeField } from "./render-intake-field";

export type IntakeFormState = Readonly<Record<string, string>>;

export type RenderIntakeFormProps = {
  readonly schema: IntakeSchema;
  readonly values: IntakeFormState;
  readonly onChange: (fieldId: string, value: string) => void;
  readonly resolveLabel: (field: IntakeField) => string;
  readonly errorId?: string;
  readonly hasError?: boolean;
};

export function RenderIntakeForm({
  schema,
  values,
  onChange,
  resolveLabel,
  errorId,
  hasError = false,
}: RenderIntakeFormProps) {
  return (
    <div data-schema-intake-form>
      {schema.fields.map((field) => (
        <RenderIntakeField
          key={field.id}
          field={field}
          value={values[field.id] ?? ""}
          label={resolveLabel(field)}
          onChange={(value) => onChange(field.id, value)}
          describedBy={hasError ? errorId : undefined}
          invalid={hasError}
        />
      ))}
    </div>
  );
}
