"use client";

import { Button, Select } from "@tour/ui";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { DenaliRuleSet } from "@repo/denali-domain";
import { finalizeDenaliWizardHydration } from "@repo/denali-domain";
import type { TourFormProfile } from "@repo/types";

import type { SettingsTourPresetDto } from "@/lib/settings-tour-presets.client";

import { applyDenaliWizardPreset } from "./tourCreationPresetApply";
import { listAllTourWizardPresetsSorted } from "./tourCreationPresetMatch";
import type { DenaliWizardHeaderPluginFormMethods } from "@/features/tours/wizard/denali/application/denaliWizardHeaderPlugin";

export type DenaliTourCreationPresetBannerProps = {
  presets: SettingsTourPresetDto[] | undefined;
  /** RHF access from wizard shell — plugins must not use `useFormContext` directly. */
  formMethods: DenaliWizardHeaderPluginFormMethods;
  ruleSet: DenaliRuleSet;
  workspaceFormProfile: TourFormProfile | undefined;
  /** Called after preset hydrate + form reset (use to bump canonical sync). */
  onApplied?: (_presetId: string) => void;
  /** Reset form to workspace template baseline (clear applied preset). */
  onClear?: () => void;
  clearLabel?: string;
};

export function DenaliTourCreationPresetBanner({
  presets,
  formMethods,
  ruleSet,
  workspaceFormProfile,
  onApplied,
  onClear,
  clearLabel,
}: DenaliTourCreationPresetBannerProps) {
  const t = useTranslations("tours.new");
  const { getValues, reset } = formMethods;

  const templateReady = workspaceFormProfile != null;

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
    const mergedValues = applyDenaliWizardPreset({
      workspaceFormProfile,
      ruleSet,
      canonicalData: selected.canonicalData,
      baseValues: getValues(),
    });
    const finalized = finalizeDenaliWizardHydration(mergedValues, ruleSet);
    reset(finalized, { keepDefaultValues: true, keepDirty: true });
    setLastAppliedPresetId(selected.id);
    onApplied?.(selected.id);
  }, [getValues, onApplied, reset, ruleSet, selected, workspaceFormProfile]);

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
        <label htmlFor="denali-wizard-preset-select" style={{ fontWeight: 600 }}>
          {t("wizardPresetSelectLabel")}
        </label>
        <Select
          id="denali-wizard-preset-select"
          data-testid="denali-wizard-preset-select"
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
            data-testid="denali-wizard-preset-apply"
            onClick={applySelected}
            disabled={!selected?.isActive || workspaceFormProfile == null}
          >
            {t("wizardPresetApply")}
          </Button>
          {onClear ? (
            <Button
              type="button"
              variant="secondary"
              data-testid="denali-wizard-preset-clear"
              onClick={() => {
                setLastAppliedPresetId(null);
                onClear();
              }}
            >
              {clearLabel ?? t("wizardPresetClear")}
            </Button>
          ) : null}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--color-neutral-600, #525252)" }}>
        {selected && !selected.isActive
          ? t("wizardPresetInactiveApplyBlocked")
          : t("wizardPresetSuggestedHint")}
      </p>
    </div>
  );
}
