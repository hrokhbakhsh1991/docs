"use client";

import { useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Checkbox, FormField } from "@tour/ui";

import { PersianNumberInput } from "@/components/forms/PersianNumberInput";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

import type { DenaliCanonicalTourModel } from "@repo/types/denali";

import { useDenaliCanonical } from "../DenaliCanonicalContext";
import { useDenaliCanonicalValue } from "../hooks/useDenaliCanonicalValue";
import { useDenaliStepFieldRules } from "../hooks/useDenaliStepFieldRules";
import { DenaliPricingParticipantSection } from "./DenaliPricingParticipantSection";

const STEP = "denali_pricing" as const;

export function DenaliPricingPaymentStep() {
  const t = useTranslations("tours.denali");
  const {
    getValues,
    formState: { errors },
  } = useFormContext<DenaliCreateTourWizardForm>();

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
      />

      <DenaliPricingParticipantSection form={form} />
    </div>
  );
}
