"use client";

import { useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Checkbox, FormField, Select, Textarea } from "@tour/ui";

import { PersianNumberInput } from "@/components/forms/PersianNumberInput";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

import { useDenaliCanonical } from "../DenaliCanonicalContext";

const PATH_MINIMUM_AGE = "participants.minimumAge";
const PATH_MAXIMUM_AGE = "participants.maximumAge";
const PATH_FITNESS_LEVEL = "participants.fitnessLevel";
const PATH_NATIONAL_ID = "participants.nationalIdRequired";
const PATH_SPORTS_INSURANCE = "participants.sportsInsuranceRequired";

/** Mountain participant requirements — owner step `denali_pricing` (placement v1). */
export function DenaliPricingParticipantSection({ form }: { form: DenaliCreateTourWizardForm }) {
  const t = useTranslations("tours.denali");
  const {
    formState: { errors },
  } = useFormContext<DenaliCreateTourWizardForm>();
  const { canonicalModel, ui, updateCanonical } = useDenaliCanonical();

  const showMinimumAge = ui.isVisible("denali_pricing", PATH_MINIMUM_AGE, form);
  const showMaximumAge = ui.isVisible("denali_pricing", PATH_MAXIMUM_AGE, form);
  const showFitnessLevel = ui.isVisible("denali_pricing", PATH_FITNESS_LEVEL, form);
  const showNationalId = ui.isVisible("denali_pricing", PATH_NATIONAL_ID, form);
  const showSportsInsurance = ui.isVisible("denali_pricing", PATH_SPORTS_INSURANCE, form);
  const showPolicies = ui.isVisible("denali_pricing", "policies.policiesText", form);

  if (
    !showMinimumAge &&
    !showMaximumAge &&
    !showFitnessLevel &&
    !showNationalId &&
    !showSportsInsurance &&
    !showPolicies
  ) {
    return null;
  }

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
      {(showMinimumAge || showMaximumAge || showFitnessLevel || showSportsInsurance) ? (
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
                  value={canonicalModel.participants.minimumAge ?? ""}
                  onChange={(v) =>
                    updateCanonical({
                      participants: {
                        ...canonicalModel.participants,
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
                  value={canonicalModel.participants.maximumAge ?? ""}
                  onChange={(v) =>
                    updateCanonical({
                      participants: {
                        ...canonicalModel.participants,
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
                value={canonicalModel.participants.fitnessLevel ?? ""}
                onChange={(e) =>
                  updateCanonical({
                    participants: {
                      ...canonicalModel.participants,
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

          {showNationalId ? (
            <Checkbox
              data-testid="denali-pricing-national-id"
              label={t("participants.nationalIdRequired")}
              checked={canonicalModel.participants.nationalIdRequired !== false}
              onChange={(e) =>
                updateCanonical({
                  participants: {
                    ...canonicalModel.participants,
                    nationalIdRequired: e.target.checked,
                  },
                })
              }
            />
          ) : null}

          {showSportsInsurance ? (
            <Checkbox
              data-testid="denali-pricing-sports-insurance"
              label={t("participants.sportsInsurance")}
              checked={Boolean(canonicalModel.participants.sportsInsuranceRequired)}
              onChange={(e) =>
                updateCanonical({
                  participants: {
                    ...canonicalModel.participants,
                    sportsInsuranceRequired: e.target.checked,
                  },
                })
              }
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
              value={canonicalModel.participants.fitnessPrerequisiteText ?? ""}
              onChange={(e) =>
                updateCanonical({
                  participants: {
                    ...canonicalModel.participants,
                    fitnessPrerequisiteText: e.target.value || undefined,
                  },
                })
              }
            />
          </FormField>
        </>
      ) : null}

      {showPolicies ? (
        <>
          <FormField
            label={t("policies.notes")}
            error={errors.policies?.policiesText?.message}
          >
            <Textarea
              rows={4}
              placeholder={t("policies.notesPlaceholder")}
              data-testid="denali-pricing-policies-notes"
              value={canonicalModel.policies.policiesText ?? ""}
              onChange={(e) =>
                updateCanonical({
                  policies: {
                    ...canonicalModel.policies,
                    policiesText: e.target.value || undefined,
                  },
                })
              }
            />
          </FormField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <FormField
              label={t("policies.cancellationDeadlineHours")}
              error={errors.policies?.cancellationDeadlineHours?.message}
            >
              <PersianNumberInput
                numericMode="integer"
                value={canonicalModel.policies.cancellationDeadlineHours ?? ""}
                onChange={(v) =>
                  updateCanonical({
                    policies: {
                      ...canonicalModel.policies,
                      cancellationDeadlineHours: v === "" ? undefined : Number(v),
                    },
                  })
                }
                data-testid="denali-pricing-cancellation-hours"
              />
            </FormField>
            <FormField
              label={t("policies.cancellationPenaltyPercentage")}
              error={errors.policies?.cancellationPenaltyPercentage?.message}
            >
              <PersianNumberInput
                numericMode="integer"
                value={canonicalModel.policies.cancellationPenaltyPercentage ?? ""}
                onChange={(v) =>
                  updateCanonical({
                    policies: {
                      ...canonicalModel.policies,
                      cancellationPenaltyPercentage: v === "" ? undefined : Number(v),
                    },
                  })
                }
                data-testid="denali-pricing-cancellation-penalty"
              />
            </FormField>
          </div>
        </>
      ) : null}
    </section>
  );
}
