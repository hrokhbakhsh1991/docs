"use client";

import { Checkbox, Input, Select, type SelectOption } from "../adapters/platform-primitives";
import { wizardFieldHasValidationIssue } from "@app-tour/wizard-navigation";
import { useTranslations } from "next-intl";

import {
  type DenaliTourWizardDraft,
  getCanonicalStringValue,
  setCanonicalStringValue,
} from "../../draft/denali-tour-wizard-draft";
import {
  resolveDenaliFieldLabel,
  resolveDenaliTransportModeLabel,
} from "../adapters/field-labels";
import { PrimitiveLocalizedNumericInput } from "../components/localized-numeric-input";
import { commitWizardDraftEdit, useLatestWizardDraft } from "../adapters/wizard-draft-edit";
import {
  DENALI_TRANSPORT_MODE_OPTIONS,
  isDenaliAdminCapacityVisible,
  isDenaliDongAmountRequired,
  isDenaliDongAmountVisible,
  isDenaliPersonalCarOptionVisible,
  isDenaliSeatPreferenceVisible,
  isDenaliTransportCostVisible,
  parseDenaliTransportMode,
} from "../logic/denali-transport-logic";

export const DENALI_TRANSPORT_TEST_IDS = {
  transport: "denali-composite-transport",
} as const;

type DenaliTransportModeFieldProps = {
  readonly draft: DenaliTourWizardDraft;
  readonly onDraftChange: (draft: DenaliTourWizardDraft) => void;
  readonly required?: boolean;
  readonly invalid?: boolean;
  readonly validationIssuePaths?: readonly string[];
};

function boolFromDraft(draft: DenaliTourWizardDraft, path: string): boolean {
  return getCanonicalStringValue(draft, path) === "true";
}

export function DenaliTransportModeField({
  draft,
  onDraftChange,
  required = false,
  invalid = false,
  validationIssuePaths = [],
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
  const modeInvalid =
    invalid || wizardFieldHasValidationIssue("transport.mode", validationIssuePaths);
  const dongInvalid = wizardFieldHasValidationIssue("transport.dongAmount", validationIssuePaths);
  const seatInvalid = wizardFieldHasValidationIssue(
    "transport.seatPreference",
    validationIssuePaths
  );

  const setString = (path: string, value: string) =>
    commitWizardDraftEdit(draftRef, onDraftChange, (base) =>
      setCanonicalStringValue(base, path, value)
    );

  const setBool = (path: string, checked: boolean) => setString(path, checked ? "true" : "false");

  return (
    <div
      className="denali-wizard-composite"
      data-operator-wizard-surface="section"
      data-testid={DENALI_TRANSPORT_TEST_IDS.transport}
      aria-invalid={invalid || undefined}
    >
      <label className="denali-wizard-composite__field">
        <span>{modeLabel}</span>
        <Select
          aria-label={modeLabel}
          options={modeOptions}
          value={mode}
          onChange={(event) => setString("transport.mode", event.target.value)}
          required={required}
          aria-required={required || undefined}
          invalid={modeInvalid}
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
            invalid={dongInvalid}
          />
        </label>
      ) : null}

      {isDenaliSeatPreferenceVisible(mode) ? (
        <label className="denali-wizard-composite__field">
          <span>{resolveDenaliFieldLabel(t, "transport.seatPreference")}</span>
          <Input
            value={getCanonicalStringValue(draft, "transport.seatPreference")}
            onChange={(event) => setString("transport.seatPreference", event.target.value)}
            required
            aria-required
            aria-invalid={seatInvalid || undefined}
            invalid={seatInvalid}
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
