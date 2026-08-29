"use client";

import { useTranslations } from "next-intl";

import {
  type DenaliTourWizardDraft,
  getCanonicalStringValue,
  setCanonicalStringValue,
} from "../../draft/denali-tour-wizard-draft";
import { applyDestinationCatalogPrefill } from "../../settings/apply-destination-catalog-prefill";
import type { DestinationResource } from "../adapters/catalog-types";
import { DenaliSearchableSelect } from "../components/denali-searchable-select";
import { DenaliCatalogLoadNotice } from "../components/denali-catalog-load-notice";
import { DenaliDestinationOfferedEmptyNotice } from "../components/denali-destination-offered-empty-notice";
import { resolveDenaliFieldLabel } from "../adapters/field-labels";
import { commitWizardDraftEdit, useLatestWizardDraft } from "../adapters/wizard-draft-edit";
import { useDenaliDestinationCatalog } from "../hooks/use-destination-catalog";
import { filterDenaliDestinationPickerOptions } from "../logic/denali-destination-picker-filter";
import { DENALI_COMPOSITE_TEST_IDS } from "../logic/denali-location-types";

type DenaliDestinationFieldProps = {
  readonly draft: DenaliTourWizardDraft;
  readonly onDraftChange: (draft: DenaliTourWizardDraft) => void;
  readonly canonicalPath: string;
  readonly required?: boolean;
  readonly invalid?: boolean;
};

function applyDestinationSelection(
  draft: DenaliTourWizardDraft,
  canonicalPath: string,
  destinationId: string,
  destinationById: ReadonlyMap<string, DestinationResource>
): DenaliTourWizardDraft {
  const next = setCanonicalStringValue(draft, canonicalPath, destinationId);
  return applyDestinationCatalogPrefill(next, destinationById.get(destinationId));
}

export function DenaliDestinationField({
  draft,
  onDraftChange,
  canonicalPath,
  required = false,
  invalid = false,
}: DenaliDestinationFieldProps) {
  const t = useTranslations("denali");
  const draftRef = useLatestWizardDraft(draft);
  const value = getCanonicalStringValue(draft, canonicalPath);
  const label = resolveDenaliFieldLabel(t, canonicalPath);
  const tourKind = getCanonicalStringValue(draft, "category");
  const { options, destinationById, loading, error, reload } = useDenaliDestinationCatalog({
    tourKind,
  });
  const visibleOptions = filterDenaliDestinationPickerOptions({
    options,
    destinationById,
    tourKind,
    selectedDestinationId: value,
  });

  return (
    <div className="denali-wizard-composite" data-testid={DENALI_COMPOSITE_TEST_IDS.destination}>
      <label className="denali-wizard-composite__field">
        <span>{label}</span>
        <DenaliSearchableSelect
          ariaLabel={label}
          options={visibleOptions}
          value={value}
          placeholder={
            loading
              ? t("composites.destination.loadingPlaceholder")
              : t("composites.destination.selectPlaceholder")
          }
          loading={loading}
          disabled={error !== null}
          required={required}
          invalid={invalid}
          searchableThreshold={0}
          requireQueryToBrowse
          searchLabel={t("composites.destination.searchLabel")}
          searchPlaceholder={t("composites.destination.searchPlaceholder")}
          searchPromptMessage={t("composites.destination.searchPlaceholder")}
          searchEmptyMessage={t("composites.destination.searchEmpty")}
          onChange={(nextId) => {
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
      <DenaliCatalogLoadNotice error={error} onRetry={reload} />
      {visibleOptions.length === 0 && !loading && error === null ? (
        <DenaliDestinationOfferedEmptyNotice onRetry={reload} />
      ) : null}
    </div>
  );
}
