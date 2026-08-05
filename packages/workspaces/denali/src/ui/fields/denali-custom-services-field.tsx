"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import {
  type DenaliTourWizardDraft,
  getCanonicalValue,
  setCanonicalValue,
} from "../../draft/denali-tour-wizard-draft";
import { resolveDenaliFieldLabel } from "../adapters/field-labels";
import { Button, Input } from "../adapters/platform-primitives";
import { commitWizardDraftEdit, useLatestWizardDraft } from "../adapters/wizard-draft-edit";
import { parseStringArray } from "../logic/denali-array-field-utils";

export const DENALI_CUSTOM_SERVICES_TEST_IDS = {
  customServices: "denali-composite-custom-services",
  add: "denali-composite-custom-services-add",
} as const;

type DenaliCustomServicesFieldProps = {
  readonly draft: DenaliTourWizardDraft;
  readonly onDraftChange: (draft: DenaliTourWizardDraft) => void;
  readonly invalid?: boolean;
};

export function DenaliCustomServicesField({
  draft,
  onDraftChange,
  invalid = false,
}: DenaliCustomServicesFieldProps) {
  const t = useTranslations("denali");
  const tCommon = useTranslations("denali.composites.common");
  const draftRef = useLatestWizardDraft(draft);
  const label = resolveDenaliFieldLabel(t, "tripDetails.overview.customServiceLabels");
  const labels = parseStringArray(
    getCanonicalValue(draft, "tripDetails.overview.customServiceLabels")
  );
  const [draftLabel, setDraftLabel] = useState("");

  const writeLabels = (next: string[]) => {
    commitWizardDraftEdit(draftRef, onDraftChange, (base) =>
      setCanonicalValue(base, "tripDetails.overview.customServiceLabels", next)
    );
  };

  const addLabel = () => {
    const trimmed = draftLabel.trim();
    if (trimmed.length === 0 || labels.includes(trimmed)) {
      return;
    }
    writeLabels([...labels, trimmed]);
    setDraftLabel("");
  };

  const removeLabel = (index: number) => {
    writeLabels(labels.filter((_, labelIndex) => labelIndex !== index));
  };

  return (
    <div
      className="denali-wizard-composite"
      data-operator-wizard-surface="section"
      data-testid={DENALI_CUSTOM_SERVICES_TEST_IDS.customServices}
      aria-invalid={invalid || undefined}
    >
      <div className="denali-wizard-composite__header">
        <h3 className="denali-wizard-composite__title">{label}</h3>
        <p className="denali-wizard-composite__helper">{t("composites.customServices.helper")}</p>
      </div>

      {labels.length === 0 ? (
        <p className="denali-wizard-composite__helper">{t("composites.customServices.empty")}</p>
      ) : (
        <ul className="denali-wizard-composite__list">
          {labels.map((entry, index) => (
            <li key={`${entry}-${index}`} className="denali-wizard-composite__list-item">
              <span>{entry}</span>
              <Button type="button" variant="secondary" onClick={() => removeLabel(index)}>
                {tCommon("remove")}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="denali-wizard-composite__inline-add">
        <label className="denali-wizard-composite__field denali-wizard-composite__field--grow">
          <span>{t("composites.customServices.newLabel")}</span>
          <Input
            value={draftLabel}
            onChange={(event) => setDraftLabel(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addLabel();
              }
            }}
            placeholder={t("composites.customServices.placeholder")}
          />
        </label>
        <Button
          type="button"
          variant="secondary"
          data-testid={DENALI_CUSTOM_SERVICES_TEST_IDS.add}
          onClick={addLabel}
        >
          {t("composites.customServices.addLabel")}
        </Button>
      </div>
    </div>
  );
}
