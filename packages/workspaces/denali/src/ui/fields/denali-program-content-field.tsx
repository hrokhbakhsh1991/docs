"use client";

import { readDenaliCanonicalBasics } from "../../adapters/denaliCanonicalBasicsControl";
import { isDenaliWizardFieldVisibleOnDraft } from "../../wizard/denali-wizard-field-visibility";
import type { DenaliWizardRuleEvalContext } from "../../wizard/denali-wizard-rule-eval-context";
import { DENALI_DEFAULT_WORKSPACE_FORM_PROFILE } from "../../wizard/denali-wizard-rule-eval-context";
import { wizardFieldHasValidationIssue, wizardFieldPathAttributes } from "@app-tour/wizard-navigation";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import {
  type DenaliTourWizardDraft,
  getCanonicalStringValue,
  getCanonicalValue,
  setCanonicalStringValue,
  setCanonicalValue,
} from "../../draft/denali-tour-wizard-draft";
import { DENALI_SUBMIT_CATALOG_BFF_PATHS } from "../../wizard/denali-wizard-catalog-sanitize";
import type { TourThemeResource, TourThemesListResponse } from "../adapters/catalog-types";
import { resolveDenaliFieldLabel } from "../adapters/field-labels";
import { commitWizardDraftEdit, useLatestWizardDraft } from "../adapters/wizard-draft-edit";
import { fetchDenaliCatalogJsonWithSoftRetry } from "../adapters/catalog-soft-fail";
import { DenaliCatalogLoadNotice } from "../components/denali-catalog-load-notice";
import { CheckIcon } from "../components/icons/tour-service-icons";
import { isTourThemeCompatibleWithWizard } from "../logic/denali-catalog-filters";
import { themeDisplayInitials, themeSwatchToneClass } from "../logic/denali-theme-picker-logic";
import { DENALI_PROGRAM_CONTENT_TEST_IDS } from "../test-ids/denali-program-content-test-ids";

export { DENALI_PROGRAM_CONTENT_TEST_IDS } from "../test-ids/denali-program-content-test-ids";

function parseThemeIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

type DenaliProgramContentFieldProps = {
  readonly draft: DenaliTourWizardDraft;
  readonly onDraftChange: (draft: DenaliTourWizardDraft) => void;
  readonly workspaceFormProfile?: string;
  readonly wizardRuleEvalContext?: Pick<DenaliWizardRuleEvalContext, "ruleSet">;
  readonly invalid?: boolean;
  readonly validationIssuePaths?: readonly string[];
};

export function DenaliProgramContentField({
  draft,
  onDraftChange,
  workspaceFormProfile = DENALI_DEFAULT_WORKSPACE_FORM_PROFILE,
  wizardRuleEvalContext,
  invalid = false,
  validationIssuePaths,
}: DenaliProgramContentFieldProps) {
  const t = useTranslations("denali");
  const draftRef = useLatestWizardDraft(draft);
  const themesLabel = resolveDenaliFieldLabel(t, "program.themeIds");
  const shortDescriptionLabel = resolveDenaliFieldLabel(t, "program.shortDescription");
  const longDescriptionLabel = resolveDenaliFieldLabel(t, "program.longDescription");
  const shortDescription = getCanonicalStringValue(draft, "program.shortDescription");
  const longDescription = getCanonicalStringValue(draft, "program.longDescription");
  const shortDescriptionInvalid =
    invalid ||
    wizardFieldHasValidationIssue("program.shortDescription", validationIssuePaths ?? []);
  const longDescriptionInvalid = wizardFieldHasValidationIssue(
    "program.longDescription",
    validationIssuePaths ?? []
  );
  const showLongDescription = useMemo(
    () =>
      isDenaliWizardFieldVisibleOnDraft(draft, "program.longDescription", "denali_photos", {
        ruleSet: wizardRuleEvalContext?.ruleSet,
      }),
    [draft, wizardRuleEvalContext]
  );
  const selected = parseThemeIds(getCanonicalValue(draft, "program.themeIds"));
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const [themes, setThemes] = useState<readonly TourThemeResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchDenaliCatalogJsonWithSoftRetry<TourThemesListResponse>(
      DENALI_SUBMIT_CATALOG_BFF_PATHS.tourThemes,
      "TOUR_THEMES"
    )
      .then((payload) => {
        if (!cancelled) {
          setThemes((payload.items ?? []).filter((theme) => theme.isActive));
          setError(null);
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "TOUR_THEMES_LOAD_FAILED");
          setThemes([]);
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

  const tourCategory = useMemo(() => {
    const tourKind = getCanonicalStringValue(draft, "category").trim();
    return readDenaliCanonicalBasics(
      (tourKind.length > 0 ? tourKind : undefined) as Parameters<
        typeof readDenaliCanonicalBasics
      >[0]
    )?.category;
  }, [draft]);

  const visibleThemes = useMemo(
    () =>
      themes.filter((theme) =>
        isTourThemeCompatibleWithWizard(theme, tourCategory, workspaceFormProfile)
      ),
    [themes, tourCategory, workspaceFormProfile]
  );

  const toggleTheme = (themeId: string) => {
    const next = selectedSet.has(themeId)
      ? selected.filter((id) => id !== themeId)
      : [...selected, themeId];
    commitWizardDraftEdit(draftRef, onDraftChange, (base) =>
      setCanonicalValue(base, "program.themeIds", next)
    );
  };

  const writeShortDescription = (next: string) => {
    commitWizardDraftEdit(draftRef, onDraftChange, (base) =>
      setCanonicalStringValue(base, "program.shortDescription", next)
    );
  };

  const writeLongDescription = (next: string) => {
    commitWizardDraftEdit(draftRef, onDraftChange, (base) =>
      setCanonicalStringValue(base, "program.longDescription", next)
    );
  };

  return (
    <div
      className="denali-wizard-composite"
      data-operator-wizard-surface="section"
      data-operator-theme-picker
      data-testid={DENALI_PROGRAM_CONTENT_TEST_IDS.themes}
    >
      <label
        className="denali-wizard-composite__field"
        {...wizardFieldPathAttributes("program.shortDescription")}
      >
        <span>{shortDescriptionLabel}</span>
        <textarea
          className="denali-wizard-composite__textarea"
          data-testid={DENALI_PROGRAM_CONTENT_TEST_IDS.shortDescription}
          value={shortDescription}
          required
          aria-required
          aria-invalid={shortDescriptionInvalid || undefined}
          rows={3}
          onChange={(event) => writeShortDescription(event.target.value)}
          onBlur={(event) => writeShortDescription(event.target.value)}
        />
      </label>

      {showLongDescription ? (
        <label
          className="denali-wizard-composite__field"
          {...wizardFieldPathAttributes("program.longDescription")}
        >
          <span>{longDescriptionLabel}</span>
          <textarea
            className="denali-wizard-composite__textarea"
            data-testid={DENALI_PROGRAM_CONTENT_TEST_IDS.longDescription}
            value={longDescription}
            aria-invalid={longDescriptionInvalid || undefined}
            rows={6}
            onChange={(event) => writeLongDescription(event.target.value)}
            onBlur={(event) => writeLongDescription(event.target.value)}
          />
        </label>
      ) : null}

      <div className="denali-wizard-composite__header">
        <h3 className="denali-wizard-composite__title">{themesLabel}</h3>
        <p className="denali-wizard-composite__helper">{t("composites.programContent.helper")}</p>
        {selected.length > 0 ? (
          <p className="denali-theme-picker__summary">
            {t("composites.programContent.selectedCount", { count: selected.length })}
          </p>
        ) : null}
      </div>

      {loading ? (
        <p className="denali-wizard-composite__status">{t("composites.programContent.loading")}</p>
      ) : null}
      <DenaliCatalogLoadNotice error={error} />

      {!loading && visibleThemes.length === 0 && error === null ? (
        <div className="denali-theme-picker__empty">
          <p className="denali-wizard-composite__status">{t("composites.programContent.empty")}</p>
          <a className="denali-wizard-composite__link" href="/settings/tour-themes">
            {t("composites.programContent.openTourThemes")}
          </a>
        </div>
      ) : null}

      {visibleThemes.length > 0 ? (
        <div className="denali-theme-picker__grid" role="list">
          {visibleThemes.map((theme) => {
            const isSelected = selectedSet.has(theme.id);
            return (
              <button
                key={theme.id}
                type="button"
                role="listitem"
                data-testid={DENALI_PROGRAM_CONTENT_TEST_IDS.card}
                data-operator-theme-card
                aria-pressed={isSelected}
                aria-label={theme.name}
                className={
                  isSelected
                    ? "denali-theme-picker__card denali-theme-picker__card--selected"
                    : "denali-theme-picker__card"
                }
                onClick={() => toggleTheme(theme.id)}
              >
                <span
                  className={`denali-theme-picker__swatch ${themeSwatchToneClass(theme.slug || theme.id)}`}
                  aria-hidden
                >
                  {themeDisplayInitials(theme.name)}
                </span>
                <span className="denali-theme-picker__body">
                  {/* ED-LBL-THEME-01: operator sees display name only; slug stays settings/catalog SoT. */}
                  <span className="denali-theme-picker__name">{theme.name}</span>
                </span>
                <span
                  className={
                    isSelected
                      ? "denali-theme-picker__check denali-theme-picker__check--visible"
                      : "denali-theme-picker__check"
                  }
                  aria-hidden
                >
                  <CheckIcon />
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
