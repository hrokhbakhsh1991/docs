"use client";

import { useController, useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Checkbox, FormField, Textarea } from "@tour/ui";

import { PersianNumberInput } from "@/components/forms/PersianNumberInput";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliPricing.schema";

import type { DenaliCanonicalTourModel } from "@repo/types/denali";

import { useDenaliCanonical, useDenaliCanonicalValue, useDenaliStepFieldRules } from "../application";
import { DenaliPricingParticipantSection } from "./DenaliPricingParticipantSection";

const STEP = "denali_pricing" as const;

/** Wizard step `denali_pricing` — payment, non-attendance note, participant requirements. */
export function DenaliPricingStep() {
  const t = useTranslations("tours.denali");
  const {
    control,
    getValues,
    formState: { errors },
  } = useFormContext<DenaliCreateTourWizardForm>();
  const { field: nonAttendanceDetailsField } = useController({
    control,
    name: "tripDetails.overview.nonAttendanceDetails",
  });

  const { updateCanonical } = useDenaliCanonical();
  const pricing = useDenaliCanonicalValue<DenaliCanonicalTourModel["pricing"]>("pricing");
  const form = getValues();
  const { isVisible } = useDenaliStepFieldRules(STEP);
  const requiresPayment = pricing.requiresPayment === true;

  return (
    <div style={{ display: "grid", gap: "0.85rem" }} data-testid="denali-step-pricing">
      <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>{t("pricing.offlineOnlyHint")}</p>

      <Checkbox
        label={t("pricing.requiresPayment")}
        checked={requiresPayment}
        onChange={(e) => {
          const checked = e.target.checked;
          updateCanonical({
            pricing: {
              ...pricing,
              requiresPayment: checked ? true : undefined,
              basePricePerPerson: checked ? pricing.basePricePerPerson : undefined,
            },
          });
        }}
        data-testid="denali-pricing-requires-payment"
      />

      {isVisible("pricing.basePricePerPerson", form) ? (
        <FormField
          label={t("pricing.basePricePerPerson")}
          description={t("pricing.basePricePerPersonHint")}
          error={errors.pricingPayment?.basePricePerPerson?.message}
        >
          <PersianNumberInput
            numericMode="integer"
            formatThousands
            value={pricing.basePricePerPerson ?? ""}
            onChange={(v) =>
              updateCanonical({
                pricing: {
                  ...pricing,
                  requiresPayment: true,
                  basePricePerPerson: v === "" ? undefined : Number(v),
                },
              })
            }
            data-testid="denali-pricing-base-price"
          />
        </FormField>
      ) : null}

      <Checkbox
        label={t("pricing.includesTourInsurance")}
        checked={pricing.includesTourInsurance === true}
        onChange={(e) =>
          updateCanonical({
            pricing: {
              ...pricing,
              includesTourInsurance: e.target.checked,
            },
          })
        }
        data-testid="denali-pricing-tour-insurance"
        data-field-path="pricingPayment.includesTourInsurance"
      />

      {isVisible("tripDetails.overview.nonAttendanceDetails", form) && (
        <FormField
          label={t("pricing.nonAttendanceDetails")}
          error={errors.tripDetails?.overview?.nonAttendanceDetails?.message}
        >
          <Textarea
            rows={3}
            placeholder={t("pricing.nonAttendanceDetailsPlaceholder")}
            value={nonAttendanceDetailsField.value ?? ""}
            onChange={(e) =>
              nonAttendanceDetailsField.onChange(
                e.target.value.trim() === "" ? undefined : e.target.value,
              )
            }
            onBlur={nonAttendanceDetailsField.onBlur}
            ref={nonAttendanceDetailsField.ref}
            data-testid="denali-non-attendance-details"
            data-field-path="tripDetails.overview.nonAttendanceDetails"
          />
        </FormField>
      )}

      <DenaliPricingParticipantSection form={form} />
    </div>
  );
}
