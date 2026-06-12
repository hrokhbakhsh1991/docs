"use client";

import React from "react";
import { Select } from "@app-tour/ui-primitives/select";
import { useTranslations } from "next-intl";

import { resolveDenaliFieldLabel } from "@/i18n/denali-wizard-labels";
import { resolveCodedErrorMessage } from "@/i18n/resolve-coded-error-message";
import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import { getCanonicalStringValue, setCanonicalStringValue } from "@/tours/tour-wizard-draft-path";

import { DENALI_COMPOSITE_TEST_IDS } from "./denali-location-types";
import { useDenaliDestinationCatalog } from "./use-denali-destination-catalog";

type DenaliDestinationFieldProps = {
  readonly draft: TourWizardDraft;
  readonly onDraftChange: (draft: TourWizardDraft) => void;
  readonly canonicalPath: string;
  readonly required?: boolean;
};

function applyDestinationSelection(
  draft: TourWizardDraft,
  canonicalPath: string,
  destinationId: string,
  destinationById: ReturnType<typeof useDenaliDestinationCatalog>["destinationById"]
): TourWizardDraft {
  let next = setCanonicalStringValue(draft, canonicalPath, destinationId);
  const altitudeM = destinationById.get(destinationId)?.altitudeM;
  if (typeof altitudeM === "number" && Number.isFinite(altitudeM) && altitudeM > 0) {
    next = setCanonicalStringValue(next, "tripDetails.overview.peakHeight", String(altitudeM));
  }
  return next;
}

export function DenaliDestinationField({
  draft,
  onDraftChange,
  canonicalPath,
  required = false,
}: DenaliDestinationFieldProps) {
  const t = useTranslations("denali");
  const tErrors = useTranslations("settings.errors");
  const { options, destinationById, loading, error } = useDenaliDestinationCatalog();
  const value = getCanonicalStringValue(draft, canonicalPath);
  const label = resolveDenaliFieldLabel(t, canonicalPath);

  return (
    <div className="denali-wizard-composite" data-testid={DENALI_COMPOSITE_TEST_IDS.destination}>
      <label className="denali-wizard-composite__field">
        <span>{label}</span>
        <Select
          aria-label={label}
          options={options}
          value={value}
          placeholder={
            loading
              ? t("composites.destination.loadingPlaceholder")
              : t("composites.destination.selectPlaceholder")
          }
          required={required}
          onChange={(event) => {
            const nextId = event.target.value;
            if (nextId.length === 0) {
              onDraftChange(setCanonicalStringValue(draft, canonicalPath, ""));
              return;
            }
            onDraftChange(applyDestinationSelection(draft, canonicalPath, nextId, destinationById));
          }}
        />
      </label>
      {error !== null ? (
        <p className="denali-wizard-composite__error">{resolveCodedErrorMessage(tErrors, error)}</p>
      ) : null}
      {options.length === 0 && !loading && error === null ? (
        <p className="denali-wizard-composite__status">{t("composites.destination.empty")}</p>
      ) : null}
    </div>
  );
}
