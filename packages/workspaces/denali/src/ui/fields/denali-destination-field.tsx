"use client";

import { useTranslations } from "next-intl";

import {
  type DenaliTourWizardDraft,
  getCanonicalStringValue,
  setCanonicalStringValue,
} from "../../draft/denali-tour-wizard-draft";
import type { DestinationResource } from "../adapters/catalog-types";
import { resolveDenaliFieldLabel } from "../adapters/field-labels";
import { resolveCodedErrorMessage } from "../adapters/i18n-errors";
import { Select } from "../adapters/platform-primitives";
import { commitWizardDraftEdit, useLatestWizardDraft } from "../adapters/wizard-draft-edit";
import { useDenaliDestinationCatalog } from "../hooks/use-destination-catalog";
import { DENALI_COMPOSITE_TEST_IDS } from "../logic/denali-location-types";

type DenaliDestinationFieldProps = {
  readonly draft: DenaliTourWizardDraft;
  readonly onDraftChange: (draft: DenaliTourWizardDraft) => void;
  readonly canonicalPath: string;
  readonly required?: boolean;
};

function applyDestinationSelection(
  draft: DenaliTourWizardDraft,
  canonicalPath: string,
  destinationId: string,
  destinationById: ReadonlyMap<string, DestinationResource>
): DenaliTourWizardDraft {
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
  const draftRef = useLatestWizardDraft(draft);
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
              commitWizardDraftEdit(draftRef, onDraftChange, (base) =>
                setCanonicalStringValue(base, canonicalPath, "")
              );
              return;
            }
            commitWizardDraftEdit(draftRef, onDraftChange, (base) =>
              applyDestinationSelection(base, canonicalPath, nextId, destinationById)
            );
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
