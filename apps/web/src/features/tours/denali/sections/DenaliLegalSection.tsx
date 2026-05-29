"use client";

import { useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";
import { FormField, Textarea } from "@tour/ui";

import { PersianNumberInput } from "@/components/forms/PersianNumberInput";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliPricing.schema";

import type { DenaliCanonicalTourModel } from "@repo/types/denali";

import { useDenaliCanonical, useDenaliCanonicalValue, useDenaliStepFieldRules } from "@/features/tours/wizard/denali/application";

const STEP = "denali_legal" as const;

/** Wizard step `denali_legal` — policies and cancellation terms. */
export function DenaliLegalSection() {
  const t = useTranslations("tours.denali");
  const {
    getValues,
    formState: { errors },
  } = useFormContext<DenaliCreateTourWizardForm>();
  const { updateCanonical } = useDenaliCanonical();
  const policies = useDenaliCanonicalValue<DenaliCanonicalTourModel["policies"]>("policies");
  const form = getValues();
  const { isVisible } = useDenaliStepFieldRules(STEP);

  const showPoliciesText = isVisible("policies.policiesText", form);
  const showCancellationDeadline = isVisible("policies.cancellationDeadlineHours", form);
  const showCancellationPenalty = isVisible("policies.cancellationPenaltyPercentage", form);
  const showPoliciesBlock = showPoliciesText || showCancellationDeadline || showCancellationPenalty;

  return (
    <div
      data-testid="denali-section-legal"
      style={{ display: "grid", gap: "0.85rem" }}
    >
      {showPoliciesBlock ? (
        <>
          {showPoliciesText ? (
            <FormField
              label={t("policies.notes")}
              error={errors.policies?.policiesText?.message}
            >
              <Textarea
                rows={4}
                placeholder={t("policies.notesPlaceholder")}
                data-testid="denali-legal-policies-notes"
                data-field-path="policies.policiesText"
                value={policies.policiesText ?? ""}
                onChange={(e) =>
                  updateCanonical({
                    policies: {
                      ...policies,
                      policiesText: e.target.value || undefined,
                    },
                  })
                }
              />
            </FormField>
          ) : null}

          {showCancellationDeadline || showCancellationPenalty ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              {showCancellationDeadline ? (
                <FormField
                  label={t("policies.cancellationDeadlineHours")}
                  error={errors.policies?.cancellationDeadlineHours?.message}
                >
                  <PersianNumberInput
                    numericMode="integer"
                    value={policies.cancellationDeadlineHours ?? ""}
                    onChange={(v) =>
                      updateCanonical({
                        policies: {
                          ...policies,
                          cancellationDeadlineHours: v === "" ? undefined : Number(v),
                        },
                      })
                    }
                    data-testid="denali-legal-cancellation-hours"
                    data-field-path="policies.cancellationDeadlineHours"
                  />
                </FormField>
              ) : null}
              {showCancellationPenalty ? (
                <FormField
                  label={t("policies.cancellationPenaltyPercentage")}
                  error={errors.policies?.cancellationPenaltyPercentage?.message}
                >
                  <PersianNumberInput
                    numericMode="integer"
                    value={policies.cancellationPenaltyPercentage ?? ""}
                    onChange={(v) =>
                      updateCanonical({
                        policies: {
                          ...policies,
                          cancellationPenaltyPercentage: v === "" ? undefined : Number(v),
                        },
                      })
                    }
                    data-testid="denali-legal-cancellation-penalty"
                    data-field-path="policies.cancellationPenaltyPercentage"
                  />
                </FormField>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
