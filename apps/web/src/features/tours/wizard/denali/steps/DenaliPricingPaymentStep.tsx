"use client";

import { useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Checkbox, FormField } from "@tour/ui";

import { PersianNumberInput } from "@/components/forms/PersianNumberInput";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

import { useDenaliCanonical } from "../DenaliCanonicalContext";
import { DenaliGearSection } from "./DenaliGearSection";
import { DenaliPricingParticipantSection } from "./DenaliPricingParticipantSection";

export function DenaliPricingPaymentStep() {
  const t = useTranslations("tours.denali");
  const {
    getValues,
    formState: { errors },
  } = useFormContext<DenaliCreateTourWizardForm>();

  const { canonicalModel, ui, updateCanonical } = useDenaliCanonical();
  const form = getValues();
  const requiresPayment = canonicalModel.pricing.requiresPayment === true;

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
              ...canonicalModel.pricing,
              requiresPayment: checked ? true : undefined,
              basePricePerPerson: checked
                ? canonicalModel.pricing.basePricePerPerson
                : undefined,
            },
          });
        }}
        data-testid="denali-pricing-requires-payment"
      />

      {ui.isVisible("denali_pricing", "pricing.basePricePerPerson", form) ? (
        <FormField
          label={t("pricing.basePricePerPerson")}
          description={t("pricing.basePricePerPersonHint")}
          error={errors.pricingPayment?.basePricePerPerson?.message}
        >
          <PersianNumberInput
            numericMode="integer"
            formatThousands
            value={canonicalModel.pricing.basePricePerPerson ?? ""}
            onChange={(v) =>
              updateCanonical({
                pricing: {
                  ...canonicalModel.pricing,
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
        checked={canonicalModel.pricing.includesTourInsurance === true}
        onChange={(e) =>
          updateCanonical({
            pricing: {
              ...canonicalModel.pricing,
              includesTourInsurance: e.target.checked,
            },
          })
        }
        data-testid="denali-pricing-tour-insurance"
      />

      <DenaliGearSection />

      <DenaliPricingParticipantSection form={form} />
    </div>
  );
}
