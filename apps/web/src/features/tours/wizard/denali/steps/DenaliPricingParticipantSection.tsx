"use client";

import { useController, useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Checkbox, FormField, Select, Textarea } from "@tour/ui";

import { PersianNumberInput } from "@/components/forms/PersianNumberInput";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliPricing.schema";

import type { DenaliCanonicalTourModel } from "@repo/types/denali";

import { DenaliPeakExperienceField } from "../components/DenaliPeakExperienceField";
import { useDenaliCanonical, useDenaliCanonicalValue, useDenaliStepFieldRules } from "../application";
import { DENALI_FIELD_HINTS, denaliFieldHintStyle } from "../denaliFieldHints";

const STEP = "denali_pricing" as const;

const PATH_MINIMUM_AGE = "participants.minimumAge";
const PATH_MAXIMUM_AGE = "participants.maximumAge";
const PATH_FITNESS_LEVEL = "participants.fitnessLevel";

/** Mountain participant requirements — owner step `denali_pricing` (placement v1). */
export function DenaliPricingParticipantSection({ form }: { form: DenaliCreateTourWizardForm }) {
  const t = useTranslations("tours.denali");
  const {
    control,
    formState: { errors },
  } = useFormContext<DenaliCreateTourWizardForm>();
  const sportsInsuranceField = useController({
    control,
    name: "participantRequirements.sportsInsuranceRequired",
  });
  const { updateCanonical } = useDenaliCanonical();
  const participants = useDenaliCanonicalValue<DenaliCanonicalTourModel["participants"]>(
    "participants",
  );
  const { isVisible } = useDenaliStepFieldRules(STEP);

  const showMinimumAge = isVisible(PATH_MINIMUM_AGE, form);
  const showMaximumAge = isVisible(PATH_MAXIMUM_AGE, form);
  const showFitnessLevel = isVisible(PATH_FITNESS_LEVEL, form);
  const showNationalId = isVisible("participants.nationalIdRequired", form);
  const showSportsInsurance = isVisible("participants.sportsInsuranceRequired", form);

  const showParticipantBlock =
    showMinimumAge || showMaximumAge || showFitnessLevel || showNationalId || showSportsInsurance;

  return (
    <section
      data-testid="denali-pricing-requirements-section"
      style={{
        display: "grid",
        gap: "0.75rem",
        padding: "0.75rem 0 0",
        borderTop: "1px solid var(--color-border-subtle, #e2e8f0)",
      }}
    >
      <DenaliPeakExperienceField />

      {showParticipantBlock ? (
        <>
          <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>
            {t("review.participantsSection")}
          </h3>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>{t("participants.mountainHint")}</p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            {showMinimumAge ? (
              <FormField
                label={t("participants.minimumAge")}
                error={errors.participantRequirements?.minimumAge?.message}
              >
                <PersianNumberInput
                  data-testid="denali-pricing-minimum-age"
                  numericMode="integer"
                  value={participants.minimumAge ?? ""}
                  onChange={(v) =>
                    updateCanonical({
                      participants: {
                        ...participants,
                        minimumAge: v === "" ? undefined : Number(v),
                      },
                    })
                  }
                />
              </FormField>
            ) : null}

            {showMaximumAge ? (
              <FormField
                label={t("participants.maximumAge")}
                error={errors.participantRequirements?.maximumAge?.message}
              >
                <PersianNumberInput
                  data-testid="denali-pricing-maximum-age"
                  numericMode="integer"
                  value={participants.maximumAge ?? ""}
                  onChange={(v) =>
                    updateCanonical({
                      participants: {
                        ...participants,
                        maximumAge: v === "" ? undefined : Number(v),
                      },
                    })
                  }
                />
              </FormField>
            ) : null}
          </div>

          {showFitnessLevel ? (
            <FormField
              label={t("participants.fitnessLevel")}
              error={errors.participantRequirements?.fitnessLevel?.message}
            >
              <Select
                data-testid="denali-pricing-fitness-level"
                value={participants.fitnessLevel ?? ""}
                onChange={(e) =>
                  updateCanonical({
                    participants: {
                      ...participants,
                      fitnessLevel: (e.target.value as "low" | "medium" | "high") || undefined,
                    },
                  })
                }
              >
                <option value="">{t("selectPlaceholder")}</option>
                <option value="low">{t("participants.fitnessLow")}</option>
                <option value="medium">{t("participants.fitnessMedium")}</option>
                <option value="high">{t("participants.fitnessHigh")}</option>
              </Select>
            </FormField>
          ) : null}

          {(showNationalId || showSportsInsurance) ? (
            <p style={denaliFieldHintStyle} dir="rtl">
              {DENALI_FIELD_HINTS.insuranceAndNationalId}
            </p>
          ) : null}

          {showNationalId ? (
            <Checkbox
              data-testid="denali-pricing-national-id"
              label={t("participants.nationalIdRequired")}
              checked={participants.nationalIdRequired !== false}
              onChange={(e) =>
                updateCanonical({
                  participants: {
                    ...participants,
                    nationalIdRequired: e.target.checked,
                  },
                })
              }
            />
          ) : null}

          {showSportsInsurance ? (
            <Checkbox
              data-testid="denali-pricing-sports-insurance"
              data-field-path="participantRequirements.sportsInsuranceRequired"
              label={t("participants.sportsInsurance")}
              checked={sportsInsuranceField.field.value === true}
              onChange={(e) => {
                      sportsInsuranceField.field.onChange(e.target.checked);
                updateCanonical({
                  participants: {
                    ...participants,
                    sportsInsuranceRequired: e.target.checked,
                  },
                });
              }}
            />
          ) : null}

          <FormField
            label={t("participants.fitnessPrerequisite")}
            error={errors.participantRequirements?.fitnessPrerequisiteText?.message}
          >
            <Textarea
              rows={3}
              placeholder={t("participants.fitnessPrerequisitePlaceholder")}
              data-testid="denali-pricing-fitness-prerequisite"
              value={participants.fitnessPrerequisiteText ?? ""}
              onChange={(e) =>
                updateCanonical({
                  participants: {
                    ...participants,
                    fitnessPrerequisiteText: e.target.value || undefined,
                  },
                })
              }
            />
          </FormField>
        </>
      ) : null}
    </section>
  );
}
