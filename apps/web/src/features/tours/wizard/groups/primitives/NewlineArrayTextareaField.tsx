"use client";

import type { ReactNode } from "react";
import { Controller, useFormContext, type FieldPathByValue } from "react-hook-form";
import { FormField, Textarea } from "@tour/ui";

import type { TourCreateFormValues } from "@/features/tours/wizard/schemas/classic/tourCreateSchema";

/** Form paths whose Zod-inferred value is `string[] | undefined`. */
export type NewlineArrayFieldPath = FieldPathByValue<
  TourCreateFormValues,
  string[] | undefined
>;

export type NewlineArrayTextareaFieldProps = {
  name: NewlineArrayFieldPath;
  label: ReactNode;
  description?: ReactNode;
  rows?: number;
  placeholder?: string;
  error?: string;
};

/**
 * Wizard primitive: `FormField` + `Textarea` whose value is a newline-joined `string[]`.
 * Preserves the exact write semantics used by the wizard today:
 *   value:  `(field.value ?? []).join("\n")`
 *   onChange: `e.target.value.split("\n").map(v => v.trim()).filter(Boolean)`
 *
 * Coupling (documented for future refactors):
 * - Requires a parent `FormProvider<TourCreateFormValues>`.
 * - Path must resolve to `string[] | undefined` (enforced by `FieldPathByValue`).
 */
export function NewlineArrayTextareaField({
  name,
  label,
  description,
  rows = 2,
  placeholder,
  error,
}: NewlineArrayTextareaFieldProps) {
  const { control } = useFormContext<TourCreateFormValues>();
  return (
    <FormField label={label} description={description} error={error}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Textarea
            rows={rows}
            placeholder={placeholder}
            value={(field.value ?? []).join("\n")}
            onChange={(e) =>
              field.onChange(
                e.target.value
                  .split("\n")
                  .map((v) => v.trim())
                  .filter(Boolean),
              )
            }
            onBlur={field.onBlur}
            name={field.name}
            ref={field.ref}
          />
        )}
      />
    </FormField>
  );
}
