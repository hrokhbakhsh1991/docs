"use client";

import { useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Checkbox, FormField, Input } from "@tour/ui";

import { PersianNumberInput } from "@/components/forms/PersianNumberInput";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";
import { resolveDenaliRegistryFieldLabel } from "@/features/tours/wizard/denali/denaliRegistryFieldLabel";

import { useDenaliCanonical, useDenaliCanonicalValue } from "@/features/tours/wizard/denali/application";

import type { DenaliZodKindFieldProps } from "./denaliZodKindFieldProps";

function fieldError(
  errors: DenaliCreateTourWizardForm | Record<string, unknown>,
  rhfPath: string,
): string | undefined {
  const segments = rhfPath.split(".");
  let current: unknown = errors;
  for (const segment of segments) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  if (current != null && typeof current === "object" && "message" in current) {
    const message = (current as { message?: unknown }).message;
    return typeof message === "string" ? message : undefined;
  }
  return undefined;
}

/** Canonical-path control for scalar registry fields (flat edit + renderer). */
export function DenaliCanonicalFieldControl({ field, required }: DenaliZodKindFieldProps) {
  const t = useTranslations("tours.denali");
  const {
    formState: { errors },
  } = useFormContext<DenaliCreateTourWizardForm>();
  const { updateCanonical } = useDenaliCanonical();
  const label = resolveDenaliRegistryFieldLabel(field.rhfPath, t);
  const error = fieldError(errors as Record<string, unknown>, field.rhfPath);
  const value = useDenaliCanonicalValue<unknown>(field.canonicalPath);

  const dataTestId = `denali-field-${field.canonicalPath.replace(/\./g, "-")}`;

  if (field.zodKind === "destinationId") {
    return null;
  }

  if (field.zodKind === "booleanOptional") {
    return (
      <FormField label={label} error={error}>
        <Checkbox
          checked={value === true}
          onChange={(e) => updateCanonical({ [field.canonicalPath]: e.target.checked } as never)}
          data-testid={dataTestId}
        />
      </FormField>
    );
  }

  if (
    field.zodKind === "optionalInt" ||
    field.zodKind === "optionalPositiveInt" ||
    field.zodKind === "capacityMax" ||
    field.zodKind === "difficultyLevel"
  ) {
    return (
      <FormField label={label} error={error} required={required}>
        <PersianNumberInput
          value={typeof value === "number" ? value : undefined}
          onChange={(n) => updateCanonical({ [field.canonicalPath]: n } as never)}
          data-testid={dataTestId}
        />
      </FormField>
    );
  }

  if (field.zodKind === "title" || field.zodKind === "stringOptional" || field.zodKind === "socialMediaLink") {
    return (
      <FormField label={label} error={error} required={required}>
        <Input
          value={typeof value === "string" ? value : ""}
          onChange={(e) => {
            const next = e.target.value;
            if (field.canonicalPath === "title") {
              updateCanonical({ title: next });
            } else {
              updateCanonical({ [field.canonicalPath]: next } as never);
            }
          }}
          data-testid={dataTestId}
        />
      </FormField>
    );
  }

  if (field.zodKind === "photos") {
    return null;
  }

  if (field.zodKind === "tourType") {
    return null;
  }

  return (
    <FormField label={label} error={error} required={required} data-testid={dataTestId}>
      <Input
        value={typeof value === "string" ? String(value ?? "") : ""}
        onChange={() => {
          /* unmapped scalar — prefer section body until wired */
        }}
        disabled
      />
    </FormField>
  );
}
