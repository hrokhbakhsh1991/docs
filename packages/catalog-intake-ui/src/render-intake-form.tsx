import type { IntakeField, IntakeSchema } from "@app-tour/workspace-sdk";

import { RenderIntakeField } from "./render-intake-field";

export type IntakeFormState = Readonly<Record<string, string>>;

export type RenderIntakeFormProps = {
  readonly schema: IntakeSchema;
  readonly values: IntakeFormState;
  readonly onChange: (fieldId: string, value: string) => void;
  readonly resolveLabel: (field: IntakeField) => string;
  readonly idPrefix: string;
  readonly errorId?: string;
  readonly invalidFieldId?: string;
};

export function RenderIntakeForm({
  schema,
  values,
  onChange,
  resolveLabel,
  idPrefix,
  errorId,
  invalidFieldId,
}: RenderIntakeFormProps) {
  return (
    <div data-schema-intake-form>
      {schema.fields.map((field) => {
        const fieldInvalid = invalidFieldId === field.id;
        return (
          <div key={field.id} data-intake-field-block data-intake-field={field.id}>
            <RenderIntakeField
              field={field}
              value={values[field.id] ?? ""}
              label={resolveLabel(field)}
              onChange={(value) => onChange(field.id, value)}
              idPrefix={idPrefix}
              describedBy={fieldInvalid ? errorId : undefined}
              invalid={fieldInvalid}
            />
          </div>
        );
      })}
    </div>
  );
}
