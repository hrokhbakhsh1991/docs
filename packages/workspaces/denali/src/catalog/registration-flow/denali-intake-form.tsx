"use client";

import { RenderIntakeField } from "@app-tour/catalog-intake-ui";
import type { IntakeField, IntakeSchema } from "@app-tour/workspace-sdk";

import { DenaliIntakeBirthDateField } from "./denali-intake-birth-date-field";

export type DenaliRenderIntakeFormProps = {
  readonly schema: IntakeSchema;
  readonly values: Readonly<Record<string, string>>;
  readonly onChange: (fieldId: string, value: string) => void;
  readonly resolveLabel: (field: IntakeField) => string;
  readonly idPrefix: string;
  readonly errorId?: string;
  readonly invalidFieldId?: string;
};

export function DenaliRenderIntakeForm({
  schema,
  values,
  onChange,
  resolveLabel,
  idPrefix,
  errorId,
  invalidFieldId,
}: DenaliRenderIntakeFormProps) {
  return (
    <div data-schema-intake-form>
      {schema.fields.map((field) => {
        const fieldInvalid = invalidFieldId === field.id;
        const describedBy = fieldInvalid ? errorId : undefined;
        return (
          <div key={field.id} data-intake-field-block={field.id}>
            {field.id === "birthDate" && field.type === "date" ? (
              <DenaliIntakeBirthDateField
                field={field}
                value={values[field.id] ?? ""}
                label={resolveLabel(field)}
                onChange={(value) => onChange(field.id, value)}
                idPrefix={idPrefix}
                describedBy={describedBy}
                invalid={fieldInvalid}
              />
            ) : (
              <RenderIntakeField
                field={field}
                value={values[field.id] ?? ""}
                label={resolveLabel(field)}
                onChange={(value) => onChange(field.id, value)}
                idPrefix={idPrefix}
                describedBy={describedBy}
                invalid={fieldInvalid}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
