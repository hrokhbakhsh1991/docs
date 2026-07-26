"use client";

import { useTranslations } from "next-intl";

import {
  type DenaliTourWizardDraft,
  getCanonicalStringValue,
  setCanonicalStringValue,
} from "../../draft/denali-tour-wizard-draft";
import { resolveDenaliFieldLabel } from "../adapters/field-labels";
import { Checkbox } from "../adapters/platform-primitives";
import { PrimitiveLocalizedNumericInput } from "../components/localized-numeric-input";
import { commitWizardDraftEdit, useLatestWizardDraft } from "../adapters/wizard-draft-edit";

export const DENALI_PRICING_TEST_IDS = {
  pricing: "denali-composite-pricing-payment",
} as const;

type DenaliPricingPaymentFieldProps = {
  readonly draft: DenaliTourWizardDraft;
  readonly onDraftChange: (draft: DenaliTourWizardDraft) => void;
};

function boolFromDraft(draft: DenaliTourWizardDraft, path: string): boolean {
  return getCanonicalStringValue(draft, path) === "true";
}

export function DenaliPricingPaymentField({
  draft,
  onDraftChange,
}: DenaliPricingPaymentFieldProps) {
  const t = useTranslations("denali");
  const draftRef = useLatestWizardDraft(draft);
  const requiresPayment = boolFromDraft(draft, "pricing.requiresPayment");
  const setString = (path: string, value: string) =>
    commitWizardDraftEdit(draftRef, onDraftChange, (base) =>
      setCanonicalStringValue(base, path, value)
    );
  const setBool = (path: string, checked: boolean) => setString(path, checked ? "true" : "false");
  const requiresPaymentLabel = resolveDenaliFieldLabel(t, "pricing.requiresPayment");
  const insuranceLabel = resolveDenaliFieldLabel(t, "pricing.includesTourInsurance");

  return (
    <div
      className="denali-wizard-composite"
      data-operator-wizard-surface="section"
      data-testid={DENALI_PRICING_TEST_IDS.pricing}
    >
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
