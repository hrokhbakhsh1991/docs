"use client";

import { useMemo } from "react";
import { useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Checkbox, FormField, Textarea } from "@tour/ui";

import { useSettingsTourThemes } from "@/hooks/use-settings-tour-themes";
import type { DenaliCanonicalTourModel } from "@repo/types/denali";

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";

import {
  useDenaliCanonical,
  useDenaliCanonicalValue,
  useDenaliStepFieldRules,
} from "@/features/tours/wizard/denali/application";

const STEP = "denali_photos" as const;

function toggleThemeId(current: string[], themeId: string, checked: boolean): string[] {
  if (checked) {
    return current.includes(themeId) ? current : [...current, themeId];
  }
  return current.filter((id) => id !== themeId);
}

/** Program copy (themes + descriptions) — phase 3 rail step 2 (`denali_photos`). */
export function DenaliProgramContentSection() {
  const t = useTranslations("tours.denali");
  const {
    formState: { errors },
  } = useFormContext<DenaliCreateTourWizardForm>();

  const { updateCanonical } = useDenaliCanonical();
  const program = useDenaliCanonicalValue<DenaliCanonicalTourModel["program"]>("program");
  const { isVisible } = useDenaliStepFieldRules(STEP);

  const themesQuery = useSettingsTourThemes();
  const activeThemes = useMemo(() => {
    const seen = new Set<string>();
    return (themesQuery.data ?? []).filter((row) => {
      if (!row.isActive) return false;
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    });
  }, [themesQuery.data]);
  const selectedThemeIds = useMemo(() => new Set(program.themeIds ?? []), [program.themeIds]);

  return (
    <div style={{ display: "grid", gap: "0.85rem" }} data-testid="denali-step-content">
      {isVisible("program.themeIds") ? (
        <FormField
          label={t("program.themesLabel")}
          description={t("program.themesHint")}
          error={(errors.programNature?.themeIds as { message?: string } | undefined)?.message}
        >
          {themesQuery.isLoading ? (
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--color-slate-500)" }}>{t("program.themesLoading")}</p>
          ) : activeThemes.length === 0 ? (
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--color-slate-500)" }}>{t("program.themesEmpty")}</p>
          ) : (
            <div style={{ display: "grid", gap: "0.5rem" }} data-testid="denali-theme-list">
              {activeThemes.map((theme) => (
                <Checkbox
                  key={theme.id}
                  label={theme.name}
                  checked={selectedThemeIds.has(theme.id)}
                  onChange={(e) => {
                    const nextIds = toggleThemeId(program.themeIds ?? [], theme.id, e.target.checked);
                    updateCanonical({
                      program: { ...program, themeIds: nextIds },
                    });
                  }}
                  data-testid={`denali-theme-select-${theme.slug}`}
                />
              ))}
            </div>
          )}
        </FormField>
      ) : null}

      {isVisible("program.shortDescription") ? (
        <FormField label={t("program.shortDescription")} error={errors.programNature?.shortDescription?.message}>
          <Textarea
            rows={4}
            value={program.shortDescription}
            data-field-path="programNature.shortDescription"
            onChange={(e) =>
              updateCanonical({ program: { ...program, shortDescription: e.target.value } })
            }
          />
        </FormField>
      ) : null}

      {isVisible("program.longDescription") ? (
        <FormField label={t("program.longDescription")} error={errors.programNature?.longDescription?.message}>
          <Textarea
            rows={6}
            value={program.longDescription ?? ""}
            data-field-path="programNature.longDescription"
            onChange={(e) =>
              updateCanonical({
                program: { ...program, longDescription: e.target.value || undefined },
              })
            }
          />
        </FormField>
      ) : null}
    </div>
  );
}
