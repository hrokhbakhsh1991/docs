"use client";

import { useTranslations } from "next-intl";

import { resolveDenaliRegistryFieldLabel } from "@/features/tours/wizard/denali/denaliRegistryFieldLabel";
import { DenaliDatetimeField } from "@/features/tours/wizard/denali/DenaliDatetimeField";

import type { DenaliZodKindFieldProps } from "../denaliZodKindFieldProps";

export function DenaliRegistryDatetimeField({ field }: DenaliZodKindFieldProps) {
  const t = useTranslations("tours.denali");
  const label = resolveDenaliRegistryFieldLabel(field.rhfPath, t);
  const canonicalField = field.canonicalPath === "endDateTime" ? "endDateTime" : "startDateTime";

  return (
    <DenaliDatetimeField
      field={canonicalField}
      label={label}
      optional={field.zodKind === "isoDateTimeOptional"}
    />
  );
}
