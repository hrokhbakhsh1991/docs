"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import {
  type DenaliTourWizardDraft,
  getCanonicalValue,
  setCanonicalValue,
} from "../../draft/denali-tour-wizard-draft";
import { DENALI_SUBMIT_CATALOG_BFF_PATHS } from "../../wizard/denali-wizard-catalog-sanitize";
import type { GuideLanguagesListResponse } from "../adapters/catalog-types";
import { resolveDenaliFieldLabel } from "../adapters/field-labels";
import { resolveCodedErrorMessage } from "../adapters/i18n-errors";
import { Checkbox } from "../adapters/platform-primitives";
import { commitWizardDraftEdit, useLatestWizardDraft } from "../adapters/wizard-draft-edit";
import { parseStringArray } from "../logic/denali-array-field-utils";
import { DENALI_GUIDE_LANGUAGES_TEST_IDS } from "../test-ids/denali-guide-languages-test-ids";

export { DENALI_GUIDE_LANGUAGES_TEST_IDS } from "../test-ids/denali-guide-languages-test-ids";

type DenaliGuideLanguageIdsFieldProps = {
  readonly draft: DenaliTourWizardDraft;
  readonly onDraftChange: (draft: DenaliTourWizardDraft) => void;
};

export function DenaliGuideLanguageIdsField({
  draft,
  onDraftChange,
}: DenaliGuideLanguageIdsFieldProps) {
  const t = useTranslations("denali");
  const tErrors = useTranslations("settings.errors");
  const draftRef = useLatestWizardDraft(draft);
  const label = resolveDenaliFieldLabel(t, "program.guideLanguageIds");
  const selected = parseStringArray(getCanonicalValue(draft, "program.guideLanguageIds"));
  const selectedSet = new Set(selected);
  const [languages, setLanguages] = useState<GuideLanguagesListResponse["items"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(DENALI_SUBMIT_CATALOG_BFF_PATHS.guideLanguages, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`GUIDE_LANGUAGES_HTTP_${response.status}`);
        }
        return (await response.json()) as GuideLanguagesListResponse;
      })
      .then((payload) => {
        if (!cancelled) {
          const items = (payload.items ?? []).filter((item) => item.isActive !== false);
          setLanguages(items);
          setError(null);
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "GUIDE_LANGUAGES_LOAD_FAILED");
          setLanguages([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
      data-denali-wizard-surface="section"
      data-testid={DENALI_GUIDE_LANGUAGES_TEST_IDS.guideLanguages}
    >
      <div className="denali-wizard-composite__header">
        <h3 className="denali-wizard-composite__title">{label}</h3>
        <p className="denali-wizard-composite__helper">{t("composites.guideLanguages.helper")}</p>
      </div>

      {loading ? (
        <p className="denali-wizard-composite__status">{t("composites.guideLanguages.loading")}</p>
      ) : null}
      {error !== null ? (
        <p className="denali-wizard-composite__error">{resolveCodedErrorMessage(tErrors, error)}</p>
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
