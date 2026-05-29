"use client";

import { useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";
import { FormField } from "@tour/ui";

import { PersianNumberInput } from "@/components/forms/PersianNumberInput";
import type { DenaliCanonicalTourModel } from "@repo/types/denali";

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";

import { useDenaliCanonical, useDenaliCanonicalValue, useDenaliStepFieldRules } from "@/features/tours/wizard/denali/application";
import { DenaliDailyItinerarySection } from "@/features/tours/denali/widgets/DenaliDailyItinerarySection";
import { DenaliItineraryStep } from "@/features/tours/denali/widgets/DenaliItineraryStep";

const STEP = "denali_program" as const;

/** Rail step 3 — outdoor metrics + daily itinerary (content lives on `denali_photos`). */
export function DenaliProgramNatureSection() {
  const t = useTranslations("tours.denali");
  const {
    formState: { errors },
    getValues,
  } = useFormContext<DenaliCreateTourWizardForm>();

  const { updateCanonical } = useDenaliCanonical();
  const program = useDenaliCanonicalValue<DenaliCanonicalTourModel["program"]>("program");
  const form = getValues();
  const { isVisible, arePathsVisible } = useDenaliStepFieldRules(STEP);

  const showOutdoorProgram = arePathsVisible(
    ["program.difficultyLevel", "program.hikingHoursApprox"],
    form,
  );
  const showDailyItinerary = isVisible("program.itinerary", form);

  return (
    <div style={{ display: "grid", gap: "0.85rem" }} data-testid="denali-section-program">
      {showOutdoorProgram ? (
        <>
          <FormField
            label={`${t("program.difficultyLevel")}: ${program.difficultyLevel ?? 5}`}
            error={errors.programNature?.difficultyLevel?.message}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <span style={{ fontSize: "0.8rem", color: "#64748b" }}>۱ (بسیار آسان)</span>
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
                style={{ flex: 1, accentColor: "var(--color-primary-600, #2563eb)" }}
                data-testid="denali-program-difficulty-slider"
              />
              <span style={{ fontSize: "0.8rem", color: "#64748b" }}>۱۰ (فنی/سخت)</span>
            </div>
          </FormField>

          <FormField label={t("program.hikingHours")} error={errors.programNature?.hikingHoursApprox?.message}>
            <PersianNumberInput
              numericMode="integer"
              value={program.hikingHoursApprox ?? ""}
              onChange={(v) =>
                updateCanonical({
                  program: {
                    ...program,
                    hikingHoursApprox: v === "" ? undefined : Number(v),
                  },
                })
              }
              data-testid="denali-program-hiking-hours"
            />
          </FormField>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <FormField
              label={t("program.hikingGoHours")}
              error={errors.programNature?.hikingGoHours?.message}
            >
              <PersianNumberInput
                numericMode="integer"
                value={program.hikingGoHours ?? ""}
                onChange={(v) =>
                  updateCanonical({
                    program: {
                      ...program,
                      hikingGoHours: v === "" ? undefined : Number(v),
                    },
                  })
                }
                data-testid="denali-program-hiking-go-hours"
              />
            </FormField>
            <FormField
              label={t("program.hikingReturnHours")}
              error={errors.programNature?.hikingReturnHours?.message}
            >
              <PersianNumberInput
                numericMode="integer"
                value={program.hikingReturnHours ?? ""}
                onChange={(v) =>
                  updateCanonical({
                    program: {
                      ...program,
                      hikingReturnHours: v === "" ? undefined : Number(v),
                    },
                  })
                }
                data-testid="denali-program-hiking-return-hours"
              />
            </FormField>
          </div>
        </>
      ) : null}

      <DenaliItineraryStep form={form} />

      {showDailyItinerary ? <DenaliDailyItinerarySection /> : null}
    </div>
  );
}
