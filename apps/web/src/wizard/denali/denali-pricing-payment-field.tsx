"use client";

import React from "react";
import { Checkbox } from "@app-tour/ui-primitives/checkbox";
import { Input } from "@app-tour/ui-primitives/input";

import { PrimitiveLocalizedNumericInput } from "@/components/i18n/localized-numeric-input";
import { useTranslations } from "next-intl";

import { resolveDenaliFieldLabel } from "@/i18n/denali-wizard-labels";
import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import { getCanonicalStringValue, setCanonicalStringValue } from "@/tours/tour-wizard-draft-path";

export const DENALI_PRICING_TEST_IDS = {
  pricing: "denali-composite-pricing-payment",
} as const;

type DenaliPricingPaymentFieldProps = {
  readonly draft: TourWizardDraft;
  readonly onDraftChange: (draft: TourWizardDraft) => void;
};

function boolFromDraft(draft: TourWizardDraft, path: string): boolean {
  return getCanonicalStringValue(draft, path) === "true";
}

export function DenaliPricingPaymentField({
  draft,
  onDraftChange,
}: DenaliPricingPaymentFieldProps) {
  const t = useTranslations("denali");
  const requiresPayment = boolFromDraft(draft, "pricing.requiresPayment");
  const setString = (path: string, value: string) =>
    onDraftChange(setCanonicalStringValue(draft, path, value));
  const setBool = (path: string, checked: boolean) => setString(path, checked ? "true" : "false");
  const requiresPaymentLabel = resolveDenaliFieldLabel(t, "pricing.requiresPayment");
  const insuranceLabel = resolveDenaliFieldLabel(t, "pricing.includesTourInsurance");

  return (
    <div className="denali-wizard-composite" data-denali-wizard-surface="section" data-testid={DENALI_PRICING_TEST_IDS.pricing}>
      <label className="denali-wizard-composite__field-row">
        <Checkbox
          aria-label={requiresPaymentLabel}
          checked={requiresPayment}
          onChange={(event) => setBool("pricing.requiresPayment", event.target.checked)}
        />
        <span>{requiresPaymentLabel}</span>
      </label>

      {requiresPayment ? (
        <label className="denali-wizard-composite__field">
          <span>{resolveDenaliFieldLabel(t, "pricing.basePricePerPerson")}</span>
          <PrimitiveLocalizedNumericInput
            mode="digits"
            groupThousands
            value={getCanonicalStringValue(draft, "pricing.basePricePerPerson")}
            onChange={(value) => setString("pricing.basePricePerPerson", value)}
            required
            aria-required
          />
        </label>
      ) : null}

      <label className="denali-wizard-composite__field-row">
        <Checkbox
          aria-label={insuranceLabel}
          checked={boolFromDraft(draft, "pricing.includesTourInsurance")}
          onChange={(event) => setBool("pricing.includesTourInsurance", event.target.checked)}
        />
        <span>{insuranceLabel}</span>
      </label>
    </div>
  );
}
