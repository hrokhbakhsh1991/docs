"use client";

import { readDenaliCanonicalBasics } from "@app-tour/workspace-denali/plugin";
import { Check } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import type { TourThemeResource, TourThemesListResponse } from "@/features/settings/settings-module-types";
import { resolveDenaliFieldLabel } from "@/i18n/denali-wizard-labels";
import { resolveCodedErrorMessage } from "@/i18n/resolve-coded-error-message";
import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import { getCanonicalStringValue, getCanonicalValue, setCanonicalValue } from "@/tours/tour-wizard-draft-path";
import { commitWizardDraftEdit, useLatestWizardDraft } from "@/wizard/use-latest-wizard-draft";

import { isTourThemeCompatibleWithWizard } from "./denali-catalog-filters";
import { themeDisplayInitials, themeSwatchToneClass } from "./denali-theme-picker-logic";
import { DENALI_DEFAULT_WORKSPACE_FORM_PROFILE } from "./denali-wizard-ui-context";

export const DENALI_PROGRAM_CONTENT_TEST_IDS = {
  themes: "denali-composite-program-themes",
  card: "denali-theme-picker-card",
} as const;

function parseThemeIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

type DenaliProgramContentFieldProps = {
  readonly draft: TourWizardDraft;
  readonly onDraftChange: (draft: TourWizardDraft) => void;
  readonly workspaceFormProfile?: string;
};

export function DenaliProgramContentField({
  draft,
  onDraftChange,
  workspaceFormProfile = DENALI_DEFAULT_WORKSPACE_FORM_PROFILE,
}: DenaliProgramContentFieldProps) {
  const t = useTranslations("denali");
  const tErrors = useTranslations("settings.errors");
  const draftRef = useLatestWizardDraft(draft);
  const label = resolveDenaliFieldLabel(t, "program.themeIds");
  const selected = parseThemeIds(getCanonicalValue(draft, "program.themeIds"));
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const [themes, setThemes] = useState<readonly TourThemeResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/settings/resources/tour_themes", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`TOUR_THEMES_HTTP_${response.status}`);
        }
        return (await response.json()) as TourThemesListResponse;
      })
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
    return readDenaliCanonicalBasics(tourKind.length > 0 ? tourKind : undefined)?.category;
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

  return (
    <div
      className="denali-wizard-composite"
      data-denali-wizard-surface="section"
      data-denali-theme-picker
      data-testid={DENALI_PROGRAM_CONTENT_TEST_IDS.themes}
    >
      <div className="denali-wizard-composite__header">
        <h3 className="denali-wizard-composite__title">{label}</h3>
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
      {error !== null ? (
        <p className="denali-wizard-composite__error">{resolveCodedErrorMessage(tErrors, error)}</p>
      ) : null}

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
                data-denali-theme-card
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
                  <span className="denali-theme-picker__name">{theme.name}</span>
                  {theme.slug ? (
                    <span className="denali-theme-picker__slug" dir="ltr">
                      {theme.slug}
                    </span>
                  ) : null}
                </span>
                <span
                  className={
                    isSelected
                      ? "denali-theme-picker__check denali-theme-picker__check--visible"
                      : "denali-theme-picker__check"
                  }
                  aria-hidden
                >
                  <Check />
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
