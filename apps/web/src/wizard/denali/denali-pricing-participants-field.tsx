"use client";

import React, { useMemo } from "react";
import { Checkbox } from "@app-tour/ui-primitives/checkbox";
import { PrimitiveLocalizedNumericInput } from "@/components/i18n/localized-numeric-input";
import { Input } from "@app-tour/ui-primitives/input";
import { Select, type SelectOption } from "@app-tour/ui-primitives/select";
import { useTranslations } from "next-intl";

import { resolveDenaliFieldLabel } from "@/i18n/denali-wizard-labels";
import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import { getCanonicalStringValue, setCanonicalStringValue } from "@/tours/tour-wizard-draft-path";

export const DENALI_PRICING_PARTICIPANTS_TEST_IDS = {
  participants: "denali-composite-pricing-participants",
} as const;

type DenaliPricingParticipantsFieldProps = {
  readonly draft: TourWizardDraft;
  readonly onDraftChange: (draft: TourWizardDraft) => void;
  readonly required?: boolean;
};

export function DenaliPricingParticipantsField({
  draft,
  onDraftChange,
  required = false,
}: DenaliPricingParticipantsFieldProps) {
  const t = useTranslations("denali");
  const fitnessOptions: readonly SelectOption[] = useMemo(
    () => [
      { value: "low", label: t("composites.pricingParticipants.fitnessLow") },
      { value: "medium", label: t("composites.pricingParticipants.fitnessMedium") },
      { value: "high", label: t("composites.pricingParticipants.fitnessHigh") },
    ],
    [t]
  );
  const setString = (path: string, value: string) =>
    onDraftChange(setCanonicalStringValue(draft, path, value));
  const setBool = (path: string, checked: boolean) => setString(path, checked ? "true" : "false");
  const fitnessLabel = resolveDenaliFieldLabel(t, "participants.fitnessLevel");
  const insuranceLabel = resolveDenaliFieldLabel(t, "participants.sportsInsuranceRequired");

  return (
    <div
      className="denali-wizard-composite"
      data-denali-wizard-surface="section"
      data-testid={DENALI_PRICING_PARTICIPANTS_TEST_IDS.participants}
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
          value={getCanonicalStringValue(draft, "participants.fitnessLevel") || "medium"}
          onChange={(event) => setString("participants.fitnessLevel", event.target.value)}
          required={required}
          aria-required={required || undefined}
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
