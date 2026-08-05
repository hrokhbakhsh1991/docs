"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import {
  type DenaliTourWizardDraft,
  getCanonicalStringValue,
  setCanonicalStringValue,
} from "../../draft/denali-tour-wizard-draft";
import { resolveDenaliFieldLabel } from "../adapters/field-labels";
import {
  Checkbox,
  Input,
  Select,
  type SelectOption,
} from "../adapters/platform-primitives";
import { PrimitiveLocalizedNumericInput } from "../components/localized-numeric-input";
import { commitWizardDraftEdit, useLatestWizardDraft } from "../adapters/wizard-draft-edit";

export const DENALI_PRICING_PARTICIPANTS_TEST_IDS = {
  participants: "denali-composite-pricing-participants",
} as const;

type DenaliPricingParticipantsFieldProps = {
  readonly draft: DenaliTourWizardDraft;
  readonly onDraftChange: (draft: DenaliTourWizardDraft) => void;
  readonly required?: boolean;
  readonly invalid?: boolean;
  readonly validationIssuePaths?: readonly string[];
};

export function DenaliPricingParticipantsField({
  draft,
  onDraftChange,
  required = false,
  invalid = false,
  validationIssuePaths = [],
}: DenaliPricingParticipantsFieldProps) {
  const t = useTranslations("denali");
  const draftRef = useLatestWizardDraft(draft);
  const fitnessOptions: readonly SelectOption[] = useMemo(
    () => [
      { value: "low", label: t("composites.pricingParticipants.fitnessLow") },
      { value: "medium", label: t("composites.pricingParticipants.fitnessMedium") },
      { value: "high", label: t("composites.pricingParticipants.fitnessHigh") },
    ],
    [t]
  );
  const setString = (path: string, value: string) =>
    commitWizardDraftEdit(draftRef, onDraftChange, (base) =>
      setCanonicalStringValue(base, path, value)
    );
  const setBool = (path: string, checked: boolean) => setString(path, checked ? "true" : "false");
  const fitnessLabel = resolveDenaliFieldLabel(t, "participants.fitnessLevel");
  const insuranceLabel = resolveDenaliFieldLabel(t, "participants.sportsInsuranceRequired");
  const minimumAgeInvalid =
    invalid ||
    validationIssuePaths.some(
      (path) => path === "participants.minimumAge" || path === "denali.pricing-participants"
    );
  const fitnessInvalid = validationIssuePaths.some((path) => path === "participants.fitnessLevel");
  const fitnessValue = getCanonicalStringValue(draft, "participants.fitnessLevel");

  return (
    <div
      className="denali-wizard-composite"
      data-operator-wizard-surface="section"
      data-testid={DENALI_PRICING_PARTICIPANTS_TEST_IDS.participants}
      aria-invalid={invalid || undefined}
    >
      <h3 className="denali-wizard-composite__title">{t("composites.pricingParticipants.sectionTitle")}</h3>

      <label className="denali-wizard-composite__field">
        <span>{resolveDenaliFieldLabel(t, "participants.minimumAge")}</span>
        <PrimitiveLocalizedNumericInput
          mode="digits"
          value={getCanonicalStringValue(draft, "participants.minimumAge")}
          onChange={(value) => setString("participants.minimumAge", value)}
          required={required}
          aria-required={required || undefined}
          invalid={minimumAgeInvalid}
        />
      </label>

      <label className="denali-wizard-composite__field">
        <span>{resolveDenaliFieldLabel(t, "participants.maximumAge")}</span>
        <PrimitiveLocalizedNumericInput
          mode="digits"
          value={getCanonicalStringValue(draft, "participants.maximumAge")}
          onChange={(value) => setString("participants.maximumAge", value)}
        />
      </label>

      <label className="denali-wizard-composite__field">
        <span>{fitnessLabel}</span>
        <Select
          aria-label={fitnessLabel}
          options={fitnessOptions}
          value={
            fitnessOptions.some((option) => option.value === fitnessValue) ? fitnessValue : ""
          }
          onChange={(event) => setString("participants.fitnessLevel", event.target.value)}
          required={required}
          aria-required={required || undefined}
          invalid={fitnessInvalid}
          placeholder={t("composites.pricingParticipants.fitnessPlaceholder")}
        />
      </label>

      <label className="denali-wizard-composite__field-row">
        <Checkbox
          aria-label={insuranceLabel}
          checked={getCanonicalStringValue(draft, "participants.sportsInsuranceRequired") === "true"}
          onChange={(event) => setBool("participants.sportsInsuranceRequired", event.target.checked)}
        />
        <span>{insuranceLabel}</span>
      </label>

      <label className="denali-wizard-composite__field">
        <span>{resolveDenaliFieldLabel(t, "participants.fitnessPrerequisiteText")}</span>
        <Input
          value={getCanonicalStringValue(draft, "participants.fitnessPrerequisiteText")}
          onChange={(event) => setString("participants.fitnessPrerequisiteText", event.target.value)}
        />
      </label>
    </div>
  );
}
