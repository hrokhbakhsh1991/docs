"use client";

import { useMemo } from "react";
import { useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Checkbox, FormField, Textarea } from "@tour/ui";

import { PersianNumberInput } from "@/components/forms/PersianNumberInput";
import { useSettingsTourThemes } from "@/hooks/use-settings-tour-themes";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

import { useDenaliCanonical } from "../DenaliCanonicalContext";
import { DenaliDailyItinerarySection } from "./DenaliDailyItinerarySection";

function toggleThemeId(current: string[], themeId: string, checked: boolean): string[] {
  if (checked) {
    return current.includes(themeId) ? current : [...current, themeId];
  }
  return current.filter((id) => id !== themeId);
}

export function DenaliProgramNatureStep() {
  const t = useTranslations("tours.denali");
  const {
    formState: { errors },
    getValues,
  } = useFormContext<DenaliCreateTourWizardForm>();

  const { canonicalModel, ui, updateCanonical } = useDenaliCanonical();

  const showOutdoorProgram = ui.arePathsVisible("denali_program", [
    "program.difficultyLevel",
    "program.hikingHoursApprox",
  ]);
  const showAltitude = ui.isVisible("denali_program", "program.altitudeMeasurement", getValues());
  const showDailyItinerary = ui.isVisible("denali_program", "program.itinerary", getValues());

  const themesQuery = useSettingsTourThemes();
  const activeThemes = useMemo(
    () => (themesQuery.data ?? []).filter((row) => row.isActive),
    [themesQuery.data],
  );
  const selectedThemeIds = useMemo(
    () => new Set(canonicalModel.program.themeIds ?? []),
    [canonicalModel.program.themeIds],
  );

  return (
    <div style={{ display: "grid", gap: "0.85rem" }} data-testid="denali-step-program">
      <FormField
        label={t("program.themesLabel")}
        description={t("program.themesHint")}
        error={
          (errors.programNature?.themeIds as { message?: string } | undefined)?.message
        }
      >
        {themesQuery.isLoading ? (
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>{t("program.themesLoading")}</p>
        ) : activeThemes.length === 0 ? (
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>{t("program.themesEmpty")}</p>
        ) : (
          <div style={{ display: "grid", gap: "0.5rem" }} data-testid="denali-theme-list">
            {activeThemes.map((theme) => (
              <Checkbox
                key={theme.id}
                label={theme.name}
                checked={selectedThemeIds.has(theme.id)}
                onChange={(e) => {
                  const nextIds = toggleThemeId(
                    canonicalModel.program.themeIds ?? [],
                    theme.id,
                    e.target.checked,
                  );
                  updateCanonical({
                    program: { ...canonicalModel.program, themeIds: nextIds },
                  });
                }}
                data-testid={`denali-theme-select-${theme.slug}`}
              />
            ))}
          </div>
        )}
      </FormField>

      <FormField label={t("program.shortDescription")} error={errors.programNature?.shortDescription?.message}>
        <Textarea
          rows={4}
          value={canonicalModel.program.shortDescription}
          onChange={(e) =>
            updateCanonical({ program: { ...canonicalModel.program, shortDescription: e.target.value } })
          }
        />
      </FormField>

      <FormField label={t("program.longDescription")} error={errors.programNature?.longDescription?.message}>
        <Textarea
          rows={6}
          value={canonicalModel.program.longDescription ?? ""}
          onChange={(e) =>
            updateCanonical({
              program: { ...canonicalModel.program, longDescription: e.target.value || undefined },
            })
          }
        />
      </FormField>

      {showOutdoorProgram ? (
        <>
          <FormField
            label={`${t("program.difficultyLevel")}: ${canonicalModel.program.difficultyLevel ?? 5}`}
            error={errors.programNature?.difficultyLevel?.message}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <span style={{ fontSize: "0.8rem", color: "#64748b" }}>۱ (بسیار آسان)</span>
              <input
                type="range"
                min="1"
                max="10"
                step="0.5"
                value={canonicalModel.program.difficultyLevel ?? 5}
                onChange={(e) =>
                  updateCanonical({
                    program: {
                      ...canonicalModel.program,
                      difficultyLevel: parseFloat(e.target.value),
                    },
                  })
                }
                style={{ flex: 1, accentColor: "var(--color-primary-600, #2563eb)" }}
                data-testid="denali-program-difficulty-slider"
              />
              <span style={{ fontSize: "0.8rem", color: "#64748b" }}>۱۰ (فنی/سخت)</span>
            </div>
          </FormField>

          <FormField label={t("program.hikingHours")} error={errors.programNature?.hikingHoursApprox?.message}>
            <PersianNumberInput
              numericMode="integer"
              value={canonicalModel.program.hikingHoursApprox ?? ""}
              onChange={(v) =>
                updateCanonical({
                  program: {
                    ...canonicalModel.program,
                    hikingHoursApprox: v === "" ? undefined : Number(v),
                  },
                })
              }
              data-testid="denali-program-hiking-hours"
            />
          </FormField>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <FormField
              label={t("program.hikingGoHours")}
              error={errors.programNature?.hikingGoHours?.message}
            >
              <PersianNumberInput
                numericMode="integer"
                value={canonicalModel.program.hikingGoHours ?? ""}
                onChange={(v) =>
                  updateCanonical({
                    program: {
                      ...canonicalModel.program,
                      hikingGoHours: v === "" ? undefined : Number(v),
                    },
                  })
                }
                data-testid="denali-program-hiking-go-hours"
              />
            </FormField>
            <FormField
              label={t("program.hikingReturnHours")}
              error={errors.programNature?.hikingReturnHours?.message}
            >
              <PersianNumberInput
                numericMode="integer"
                value={canonicalModel.program.hikingReturnHours ?? ""}
                onChange={(v) =>
                  updateCanonical({
                    program: {
                      ...canonicalModel.program,
                      hikingReturnHours: v === "" ? undefined : Number(v),
                    },
                  })
                }
                data-testid="denali-program-hiking-return-hours"
              />
            </FormField>
          </div>
        </>
      ) : null}

      {showAltitude ? (
        <FormField
          label={t("program.altitudeMeasurement")}
          error={errors.programNature?.altitudeMeasurement?.message}
        >
          <PersianNumberInput
            numericMode="integer"
            formatThousands
            value={canonicalModel.program.altitudeMeasurement ?? ""}
            onChange={(v) =>
              updateCanonical({
                program: {
                  ...canonicalModel.program,
                  altitudeMeasurement: v === "" ? undefined : Number(v),
                },
              })
            }
            data-testid="denali-program-altitude"
          />
        </FormField>
      ) : null}

      {showDailyItinerary ? <DenaliDailyItinerarySection /> : null}
    </div>
  );
}
