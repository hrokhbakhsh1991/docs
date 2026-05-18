"use client";

import type { ReactNode } from "react";
import { useFormContext, type FieldPath } from "react-hook-form";
import { FormField, Textarea } from "@tour/ui";

import type { TourCreateFormValues } from "@/components/tours/wizard/schemas/tourCreateSchema";
import { FieldGate } from "@/features/tours/wizard/profileRulesReact";
import type { WizardFieldPath } from "@/features/tours/wizard/profileRules/types";

export type LabeledTextareaFieldProps = {
  name: FieldPath<TourCreateFormValues>;
  label: ReactNode;
  description?: ReactNode;
  rows?: number;
  placeholder?: string;
  error?: string;
};

/**
 * Wizard primitive: `FormField` + `Textarea` bound via ambient `useFormContext().register(name)`.
 * Now wrapped in `FieldGate` so visibility follows profile rules automatically.
 *
 * Coupling (documented for future refactors):
 * - Requires a parent `FormProvider<TourCreateFormValues>`.
 * - Path string must point to a Zod-validated `string` (or `string | undefined`) slot.
 */
export function LabeledTextareaField({
  name,
  label,
  description,
  rows = 3,
  placeholder,
  error,
}: LabeledTextareaFieldProps) {
  const { register } = useFormContext<TourCreateFormValues>();
  return (
    <FieldGate field={name as WizardFieldPath}>
      <FormField label={label} description={description} error={error}>
        <Textarea rows={rows} placeholder={placeholder} {...register(name)} />
      </FormField>
    </FieldGate>
  );
}
