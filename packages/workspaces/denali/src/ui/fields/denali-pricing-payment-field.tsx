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
  unpaidHint: "denali-pricing-unpaid-hint",
  allowMembershipDiscount: "denali-pricing-allow-membership-discount",
} as const;

type DenaliPricingPaymentFieldProps = {
  readonly draft: DenaliTourWizardDraft;
  readonly onDraftChange: (draft: DenaliTourWizardDraft) => void;
  readonly invalid?: boolean;
  readonly validationIssuePaths?: readonly string[];
};

function boolFromDraft(draft: DenaliTourWizardDraft, path: string): boolean {
  return getCanonicalStringValue(draft, path) === "true";
}

export function DenaliPricingPaymentField({
  draft,
  onDraftChange,
  invalid = false,
  validationIssuePaths = [],
}: DenaliPricingPaymentFieldProps) {
  const t = useTranslations("denali");
  const draftRef = useLatestWizardDraft(draft);
  const requiresPayment = boolFromDraft(draft, "pricing.requiresPayment");
  const prepaymentEnabled = boolFromDraft(draft, "pricing.prepaymentEnabled");
  const setString = (path: string, value: string) =>
    commitWizardDraftEdit(draftRef, onDraftChange, (base) =>
      setCanonicalStringValue(base, path, value)
    );
  const setBool = (path: string, checked: boolean) => setString(path, checked ? "true" : "false");
  const requiresPaymentLabel = resolveDenaliFieldLabel(t, "pricing.requiresPayment");
  const prepaymentLabel = resolveDenaliFieldLabel(t, "pricing.prepaymentEnabled");
  const insuranceLabel = resolveDenaliFieldLabel(t, "pricing.includesTourInsurance");
  const allowMembershipDiscountLabel = resolveDenaliFieldLabel(
    t,
    "pricing.allowMembershipDiscount"
  );
  const allowMembershipDiscount = boolFromDraft(draft, "pricing.allowMembershipDiscount");
  const priceInvalid =
    invalid ||
    validationIssuePaths.some(
      (path) =>
        path === "pricing.basePricePerPerson" || path === "denali.pricing-payment"
    );
  const prepaymentPercentInvalid =
    invalid ||
    validationIssuePaths.some(
      (path) =>
        path === "pricing.prepaymentPercent" || path === "denali.pricing-payment"
    );

  return (
    <div
      className="denali-wizard-composite"
      data-operator-wizard-surface="section"
      data-testid={DENALI_PRICING_TEST_IDS.pricing}
      aria-invalid={invalid || undefined}
    >
      <label className="denali-wizard-composite__field-row">
        <Checkbox
          aria-label={requiresPaymentLabel}
          checked={requiresPayment}
          onChange={(event) => setBool("pricing.requiresPayment", event.target.checked)}
        />
        <span>{requiresPaymentLabel}</span>
      </label>
      {requiresPayment ? null : (
        <p
          className="denali-wizard-composite__status"
          role="status"
          data-testid={DENALI_PRICING_TEST_IDS.unpaidHint}
        >
          {t("composites.pricing.unpaidHint")}
        </p>
      )}

      {requiresPayment ? (
        <>
          <label className="denali-wizard-composite__field-row">
            <Checkbox
              aria-label={prepaymentLabel}
              checked={prepaymentEnabled}
              onChange={(event) => setBool("pricing.prepaymentEnabled", event.target.checked)}
            />
            <span>{prepaymentLabel}</span>
          </label>

          {prepaymentEnabled ? (
            <label className="denali-wizard-composite__field">
              <span>{resolveDenaliFieldLabel(t, "pricing.prepaymentPercent")}</span>
              <PrimitiveLocalizedNumericInput
                mode="digits"
                value={getCanonicalStringValue(draft, "pricing.prepaymentPercent")}
                onChange={(value) => setString("pricing.prepaymentPercent", value)}
                required
                aria-required
                invalid={prepaymentPercentInvalid}
              />
            </label>
          ) : null}

          <label className="denali-wizard-composite__field">
            <span>{resolveDenaliFieldLabel(t, "pricing.basePricePerPerson")}</span>
            <PrimitiveLocalizedNumericInput
              mode="digits"
              groupThousands
              value={getCanonicalStringValue(draft, "pricing.basePricePerPerson")}
              onChange={(value) => setString("pricing.basePricePerPerson", value)}
              required
              aria-required
              invalid={priceInvalid}
            />
          </label>

          <label
            className="denali-wizard-composite__field-row"
            data-testid={DENALI_PRICING_TEST_IDS.allowMembershipDiscount}
          >
            <Checkbox
              aria-label={allowMembershipDiscountLabel}
              checked={allowMembershipDiscount}
              onChange={(event) =>
                setBool("pricing.allowMembershipDiscount", event.target.checked)
              }
            />
            <span>{allowMembershipDiscountLabel}</span>
          </label>
        </>
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
