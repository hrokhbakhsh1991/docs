"use client";

import { useTranslations } from "next-intl";

import {
  type DenaliTourWizardDraft,
  getCanonicalValue,
  setCanonicalValue,
} from "../../draft/denali-tour-wizard-draft";
import { DENALI_SUBMIT_CATALOG_BFF_PATHS } from "../../wizard/denali-wizard-catalog-sanitize";
import type { GuideLanguagesListResponse } from "../adapters/catalog-types";
import { resolveDenaliFieldLabel } from "../adapters/field-labels";
import { Checkbox } from "../adapters/platform-primitives";
import { commitWizardDraftEdit, useLatestWizardDraft } from "../adapters/wizard-draft-edit";
import { fetchDenaliCatalogJsonWithSoftRetry } from "../adapters/catalog-soft-fail";
import { DenaliCatalogLoadNotice } from "../components/denali-catalog-load-notice";
import { DenaliOptionalEmptyNotice } from "../components/denali-optional-empty-notice";
import { useDenaliCatalogSoftLoad } from "../hooks/use-denali-catalog-soft-load";
import { parseStringArray } from "../logic/denali-array-field-utils";
import { resolveDenaliOptionalEmptyReason } from "../logic/denali-optional-empty";
import { DENALI_GUIDE_LANGUAGES_TEST_IDS } from "../test-ids/denali-guide-languages-test-ids";

export { DENALI_GUIDE_LANGUAGES_TEST_IDS } from "../test-ids/denali-guide-languages-test-ids";

type DenaliGuideLanguageIdsFieldProps = {
  readonly draft: DenaliTourWizardDraft;
  readonly onDraftChange: (draft: DenaliTourWizardDraft) => void;
  readonly invalid?: boolean;
};

export function DenaliGuideLanguageIdsField({
  draft,
  onDraftChange,
  invalid = false,
}: DenaliGuideLanguageIdsFieldProps) {
  const t = useTranslations("denali");
  const draftRef = useLatestWizardDraft(draft);
  const label = resolveDenaliFieldLabel(t, "program.guideLanguageIds");
  const selected = parseStringArray(getCanonicalValue(draft, "program.guideLanguageIds"));
  const selectedSet = new Set(selected);
  const { data, loading, error, reload } = useDenaliCatalogSoftLoad(
    async () => {
      const payload = await fetchDenaliCatalogJsonWithSoftRetry<GuideLanguagesListResponse>(
        DENALI_SUBMIT_CATALOG_BFF_PATHS.guideLanguages,
        "GUIDE_LANGUAGES"
      );
      return (payload.items ?? []).filter((item) => item.isActive !== false);
    },
    "GUIDE_LANGUAGES_LOAD_FAILED"
  );
  const languages = data ?? [];
  const optionalEmptyReason = resolveDenaliOptionalEmptyReason({
    loading,
    error,
    catalogItemCount: languages.length,
    selectedCount: selected.length,
  });

  const toggleLanguage = (languageId: string, checked: boolean) => {
    const next = checked
      ? [...selected, languageId]
      : selected.filter((id) => id !== languageId);
    commitWizardDraftEdit(draftRef, onDraftChange, (base) =>
      setCanonicalValue(base, "program.guideLanguageIds", next)
    );
  };

  return (
    <div
      className="denali-wizard-composite"
      data-operator-wizard-surface="section"
      data-testid={DENALI_GUIDE_LANGUAGES_TEST_IDS.guideLanguages}
      aria-invalid={invalid || undefined}
    >
      <div className="denali-wizard-composite__header">
        <h3 className="denali-wizard-composite__title">{label}</h3>
        <p className="denali-wizard-composite__helper">{t("composites.guideLanguages.helper")}</p>
      </div>

      {loading ? (
        <p className="denali-wizard-composite__status">{t("composites.guideLanguages.loading")}</p>
      ) : null}
      <DenaliCatalogLoadNotice error={error} onRetry={reload} />

      {optionalEmptyReason != null ? (
        <DenaliOptionalEmptyNotice testId={DENALI_GUIDE_LANGUAGES_TEST_IDS.optionalEmpty}>
          {t("composites.guideLanguages.optionalEmpty")}
        </DenaliOptionalEmptyNotice>
      ) : null}

      {!loading && languages.length === 0 && error === null ? (
        <p className="denali-wizard-composite__status">{t("composites.guideLanguages.empty")}</p>
      ) : null}

      {languages.map((language) => (
        <label key={language.id} className="denali-wizard-composite__field-row">
          <Checkbox
            aria-label={language.name}
            checked={selectedSet.has(language.id)}
            onChange={(event) => toggleLanguage(language.id, event.target.checked)}
          />
          <span>{language.name}</span>
        </label>
      ))}
    </div>
  );
}
