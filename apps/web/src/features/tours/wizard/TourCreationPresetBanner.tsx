"use client";

import { Button, Select } from "@tour/ui";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFormContext } from "react-hook-form";

import type { TourFormProfile } from "@repo/types";

import type { TourCreateFormValues } from "@/features/tours/wizard/schemas/classic/tourCreateSchema";
import { useSettingsTourThemes } from "@/hooks/use-settings-tour-themes";
import { useTenantWizardTemplate } from "@/hooks/use-tenant-wizard-template";
import type { SettingsTourPresetDto } from "@/lib/settings-tour-presets.client";

import { applyTourCreationPreset } from "./tourCreationPresetApply";
import { listAllTourWizardPresetsSorted } from "./tourCreationPresetMatch";
import { resolveWorkspaceTourFormProfileFromTemplate } from "./resolveWorkspaceTourFormProfile";

export type TourCreationPresetBannerProps = {
  presets: SettingsTourPresetDto[] | undefined;
  /**
   * @deprecated Banner reads profile from {@link useTenantWizardTemplate} (`base_profile`).
   * Parent may still pass `resolvedFormProfile` for display parity; apply is blocked until template loads.
   */
  resolvedFormProfile?: TourFormProfile;
};

export function TourCreationPresetBanner({ presets }: TourCreationPresetBannerProps) {
  const t = useTranslations("tours.new");
  const { getValues, reset } = useFormContext<TourCreateFormValues>();
  const themesQuery = useSettingsTourThemes();
  const wizardTemplateQuery = useTenantWizardTemplate();

  const templateReady =
    !wizardTemplateQuery.isLoading &&
    !wizardTemplateQuery.isError &&
    wizardTemplateQuery.data != null;

  const workspaceFormProfile = useMemo((): TourFormProfile | undefined => {
    if (!wizardTemplateQuery.data) {
      return undefined;
    }
    return resolveWorkspaceTourFormProfileFromTemplate(wizardTemplateQuery.data);
  }, [wizardTemplateQuery.data]);

  const choiceList = useMemo(
    () =>
      templateReady && workspaceFormProfile != null
        ? listAllTourWizardPresetsSorted(presets, workspaceFormProfile)
        : [],
    [presets, templateReady, workspaceFormProfile],
  );

  const [selectedId, setSelectedId] = useState<string>("");
  const [lastAppliedPresetId, setLastAppliedPresetId] = useState<string | null>(null);

  useEffect(() => {
    const ids = new Set(choiceList.map((p) => p.id));
    setSelectedId((prev) => (prev && ids.has(prev) ? prev : (choiceList[0]?.id ?? "")));
  }, [choiceList]);

  const selected = useMemo(
    () => choiceList.find((p) => p.id === selectedId) ?? null,
    [choiceList, selectedId],
  );

  const appliedForCurrentChoice = selected != null && lastAppliedPresetId === selected.id;

  const applySelected = useCallback(() => {
    if (!selected?.isActive || workspaceFormProfile == null) {
      return;
    }
    const mergedValues = applyTourCreationPreset({
      resolvedFormProfile: workspaceFormProfile,
      defaults: selected.defaults,
      baseValues: getValues(),
      themeCatalog: themesQuery.data,
      ctx: {
        matchTourType: selected.matchTourType,
        matchMainTourThemeId: selected.matchMainTourThemeId,
      },
    });
    reset(mergedValues);
    setLastAppliedPresetId(selected.id);
  }, [getValues, reset, selected, workspaceFormProfile, themesQuery.data]);

  const onSelectChange = useCallback((nextId: string) => {
    setSelectedId(nextId);
    setLastAppliedPresetId(null);
  }, []);

  if (!presets?.length) {
    return null;
  }

  if (!templateReady || workspaceFormProfile == null) {
    return null;
  }

  if (choiceList.length === 0) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label={t("wizardPresetBannerAria")}
      style={{
        display: "grid",
        gap: "0.5rem",
        padding: "0.65rem 0.75rem",
        borderRadius: 8,
        background: "var(--color-primary-50, #eff6ff)",
        border: "1px solid var(--color-primary-100, #dbeafe)",
        fontSize: "0.875rem",
        color: "var(--color-neutral-800, #1e293b)",
      }}
    >
      <p style={{ margin: 0 }}>
        <strong>{t("wizardPresetBannerTitle")}</strong> {t("wizardPresetIntroHint")}
      </p>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "0.65rem",
        }}
      >
        <label htmlFor="tour-creation-preset-select" style={{ fontWeight: 600 }}>
          {t("wizardPresetSelectLabel")}
        </label>
        <Select
          id="tour-creation-preset-select"
          aria-label={t("wizardPresetSelectLabel")}
          value={selectedId}
          onChange={(e) => onSelectChange(e.target.value)}
          style={{ minWidth: "14rem", flex: "1 1 12rem" }}
        >
          {choiceList.map((p) => (
            <option key={p.id} value={p.id} title={p.description ?? undefined} disabled={!p.isActive}>
              {p.name}
              {!p.isActive ? ` (${t("wizardPresetInactiveOptionSuffix")})` : ""}
            </option>
          ))}
        </Select>
        <span style={{ display: "inline-flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          {appliedForCurrentChoice ? (
            <span style={{ fontSize: "0.8125rem", color: "var(--color-neutral-600, #525252)" }}>
              {t("wizardPresetAppliedStatus")}
            </span>
          ) : null}
          <Button
            type="button"
            variant="primary"
            onClick={applySelected}
            disabled={!selected?.isActive || workspaceFormProfile == null}
          >
            {t("wizardPresetApply")}
          </Button>
        </span>
      </div>
      <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--color-neutral-600, #525252)" }}>
        {selected && !selected.isActive ? t("wizardPresetInactiveApplyBlocked") : t("wizardPresetSuggestedHint")}
      </p>
    </div>
  );
}
