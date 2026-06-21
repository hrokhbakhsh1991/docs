"use client";

import React from "react";
import { Checkbox } from "@app-tour/ui-primitives/checkbox";
import { Input } from "@app-tour/ui-primitives/input";

import { PrimitiveLocalizedNumericInput } from "@/components/i18n/localized-numeric-input";
import { Select, type SelectOption } from "@app-tour/ui-primitives/select";
import { useTranslations } from "next-intl";

import {
  resolveDenaliFieldLabel,
  resolveDenaliTransportModeLabel,
} from "@/i18n/denali-wizard-labels";
import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import { getCanonicalStringValue, setCanonicalStringValue } from "@/tours/tour-wizard-draft-path";
import { commitWizardDraftEdit, useLatestWizardDraft } from "@/wizard/use-latest-wizard-draft";

import {
  DENALI_TRANSPORT_MODE_OPTIONS,
  isDenaliAdminCapacityVisible,
  isDenaliDongAmountRequired,
  isDenaliDongAmountVisible,
  isDenaliPersonalCarOptionVisible,
  isDenaliSeatPreferenceVisible,
  isDenaliTransportCostVisible,
  parseDenaliTransportMode,
} from "./denali-transport-logic";

export const DENALI_TRANSPORT_TEST_IDS = {
  transport: "denali-composite-transport",
} as const;

type DenaliTransportModeFieldProps = {
  readonly draft: TourWizardDraft;
  readonly onDraftChange: (draft: TourWizardDraft) => void;
  readonly required?: boolean;
};

function boolFromDraft(draft: TourWizardDraft, path: string): boolean {
  return getCanonicalStringValue(draft, path) === "true";
}

export function DenaliTransportModeField({
  draft,
  onDraftChange,
  required = false,
}: DenaliTransportModeFieldProps) {
  const t = useTranslations("denali");
  const draftRef = useLatestWizardDraft(draft);
  const mode = parseDenaliTransportMode(getCanonicalStringValue(draft, "transport.mode"));
  const allowPersonalCar = boolFromDraft(draft, "transport.allowPersonalCar");
  const modeLabel = resolveDenaliFieldLabel(t, "transport.mode");
  const modeOptions: readonly SelectOption[] = DENALI_TRANSPORT_MODE_OPTIONS.map((option) => ({
    value: option.value,
    label: resolveDenaliTransportModeLabel(t, option.value),
  }));

  const setString = (path: string, value: string) =>
    commitWizardDraftEdit(draftRef, onDraftChange, (base) =>
      setCanonicalStringValue(base, path, value)
    );

  const setBool = (path: string, checked: boolean) => setString(path, checked ? "true" : "false");

  return (
    <div className="denali-wizard-composite" data-denali-wizard-surface="section" data-testid={DENALI_TRANSPORT_TEST_IDS.transport}>
      <label className="denali-wizard-composite__field">
        <span>{modeLabel}</span>
        <Select
          aria-label={modeLabel}
          options={modeOptions}
          value={mode}
          onChange={(event) => setString("transport.mode", event.target.value)}
          required={required}
          aria-required={required || undefined}
        />
      </label>

      {isDenaliTransportCostVisible(mode) ? (
        <label className="denali-wizard-composite__field">
          <span>{resolveDenaliFieldLabel(t, "transport.transportCost")}</span>
          <PrimitiveLocalizedNumericInput
            mode="digits"
            groupThousands
            value={getCanonicalStringValue(draft, "transport.transportCost")}
            onChange={(value) => setString("transport.transportCost", value)}
          />
        </label>
      ) : null}

      {isDenaliPersonalCarOptionVisible(mode) ? (
        <label className="denali-wizard-composite__field-row">
          <Checkbox
            aria-label={resolveDenaliFieldLabel(t, "transport.allowPersonalCar")}
            checked={allowPersonalCar}
            onChange={(event) => setBool("transport.allowPersonalCar", event.target.checked)}
          />
          <span>{resolveDenaliFieldLabel(t, "transport.allowPersonalCar")}</span>
        </label>
      ) : null}

      {isDenaliDongAmountVisible(mode, allowPersonalCar) ? (
        <label className="denali-wizard-composite__field">
          <span>{resolveDenaliFieldLabel(t, "transport.dongAmount")}</span>
          <PrimitiveLocalizedNumericInput
            mode="digits"
            groupThousands
            value={getCanonicalStringValue(draft, "transport.dongAmount")}
            onChange={(value) => setString("transport.dongAmount", value)}
            required={isDenaliDongAmountRequired(mode, allowPersonalCar)}
            aria-required={isDenaliDongAmountRequired(mode, allowPersonalCar) || undefined}
          />
        </label>
      ) : null}

      {isDenaliSeatPreferenceVisible(mode) ? (
        <label className="denali-wizard-composite__field">
          <span>{resolveDenaliFieldLabel(t, "transport.seatPreference")}</span>
          <Input
            value={getCanonicalStringValue(draft, "transport.seatPreference")}
            onChange={(event) => setString("transport.seatPreference", event.target.value)}
          />
        </label>
      ) : null}

      {isDenaliAdminCapacityVisible(mode, allowPersonalCar) ? (
        <label className="denali-wizard-composite__field-row">
          <Checkbox
            aria-label={resolveDenaliFieldLabel(t, "transport.adminCapacityApproval")}
            checked={boolFromDraft(draft, "transport.adminCapacityApproval")}
            onChange={(event) =>
              setBool("transport.adminCapacityApproval", event.target.checked)
            }
          />
          <span>{resolveDenaliFieldLabel(t, "transport.adminCapacityApproval")}</span>
        </label>
      ) : null}

      <label className="denali-wizard-composite__field">
        <span>{resolveDenaliFieldLabel(t, "transport.transportNotes")}</span>
        <Input
          value={getCanonicalStringValue(draft, "transport.transportNotes")}
          onChange={(event) => setString("transport.transportNotes", event.target.value)}
        />
      </label>
    </div>
  );
}
