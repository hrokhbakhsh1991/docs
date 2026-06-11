"use client";

import { readDenaliCanonicalBasics } from "@app-tour/workspace-denali/plugin";
import React, { useEffect, useMemo, useState } from "react";
import { Checkbox } from "@app-tour/ui-primitives/checkbox";
import { useTranslations } from "next-intl";

import type { TourThemeResource, TourThemesListResponse } from "@/features/settings/settings-module-types";
import { resolveDenaliFieldLabel } from "@/i18n/denali-wizard-labels";
import { resolveCodedErrorMessage } from "@/i18n/resolve-coded-error-message";
import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import { getCanonicalStringValue, getCanonicalValue, setCanonicalValue } from "@/tours/tour-wizard-draft-path";

import { isTourThemeCompatibleWithWizard } from "./denali-catalog-filters";
import { DENALI_DEFAULT_WORKSPACE_FORM_PROFILE } from "./denali-wizard-ui-context";

export const DENALI_PROGRAM_CONTENT_TEST_IDS = {
  themes: "denali-composite-program-themes",
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
  const label = resolveDenaliFieldLabel(t, "program.themeIds");
  const selected = parseThemeIds(getCanonicalValue(draft, "program.themeIds"));
  const selectedSet = new Set(selected);
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

  const toggleTheme = (themeId: string, checked: boolean) => {
    const next = checked
      ? [...selected, themeId]
      : selected.filter((id) => id !== themeId);
    onDraftChange(setCanonicalValue(draft, "program.themeIds", next));
  };

  return (
    <div className="denali-wizard-composite" data-denali-wizard-surface="section" data-testid={DENALI_PROGRAM_CONTENT_TEST_IDS.themes}>
      <div className="denali-wizard-composite__header">
        <h3 className="denali-wizard-composite__title">{label}</h3>
        <p className="denali-wizard-composite__helper">{t("composites.programContent.helper")}</p>
      </div>

      {loading ? (
        <p className="denali-wizard-composite__status">{t("composites.programContent.loading")}</p>
      ) : null}
      {error !== null ? (
        <p className="denali-wizard-composite__error">{resolveCodedErrorMessage(tErrors, error)}</p>
      ) : null}

      {!loading && visibleThemes.length === 0 && error === null ? (
        <p className="denali-wizard-composite__status">{t("composites.programContent.empty")}</p>
      ) : null}

      {visibleThemes.map((theme) => (
        <label key={theme.id} className="denali-wizard-composite__field-row">
          <Checkbox
            aria-label={theme.name}
            checked={selectedSet.has(theme.id)}
            onChange={(event) => toggleTheme(theme.id, event.target.checked)}
          />
          <span>{theme.name}</span>
        </label>
      ))}
    </div>
  );
}
