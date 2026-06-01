"use client";

import { useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";
import { FormField } from "@tour/ui";

import type { DenaliCanonicalTourModel } from "@repo/types/denali";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";
import {
  useDenaliCanonical,
  useDenaliCanonicalValue,
} from "@/features/tours/wizard/denali/application";

import type { DenaliZodKindFieldProps } from "../denaliZodKindFieldProps";

export function DenaliDifficultyLevelField(_props: DenaliZodKindFieldProps) {
  const t = useTranslations("tours.denali");
  const {
    formState: { errors },
  } = useFormContext<DenaliCreateTourWizardForm>();
  const { updateCanonical } = useDenaliCanonical();
  const program = useDenaliCanonicalValue<DenaliCanonicalTourModel["program"]>("program");

  return (
    <FormField
      label={`${t("program.difficultyLevel")}: ${program.difficultyLevel ?? 5}`}
      error={errors.programNature?.difficultyLevel?.message}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <span style={{ fontSize: "0.8rem", color: "var(--color-slate-500)" }}>۱ (بسیار آسان)</span>
        <input
          type="range"
          min="1"
          max="10"
          step="0.5"
          value={program.difficultyLevel ?? 5}
          onChange={(e) =>
            updateCanonical({
              program: {
                ...program,
                difficultyLevel: parseFloat(e.target.value),
              },
            })
          }
          style={{ flex: 1, accentColor: "var(--color-primary-600)" }}
          data-testid="denali-program-difficulty-slider"
        />
        <span style={{ fontSize: "0.8rem", color: "var(--color-slate-500)" }}>۱۰ (فنی/سخت)</span>
      </div>
    </FormField>
  );
}
