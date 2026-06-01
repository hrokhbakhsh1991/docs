"use client";

import { Button, Select } from "@tour/ui";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { DenaliRuleSet } from "@repo/denali-domain";
import type { TourFormProfile } from "@repo/types";

import type { SettingsTourPresetDto } from "@/lib/settings-tour-presets.client";
import { DENALI_QUIET_FORM_RESET_OPTIONS } from "@/features/tours/wizard/denali/denaliCanonicalFormAdapter";
import type { TenantWizardTemplate } from "@/features/tours/wizard/template/tenant-wizard-template.types";

import { applyDenaliWizardPreset } from "./tourCreationPresetApply";
import { listAllTourWizardPresetsSorted } from "./tourCreationPresetMatch";
import type { DenaliWizardHeaderPluginFormMethods } from "@/features/tours/wizard/denali/application/denaliWizardHeaderPlugin";

export type DenaliTourCreationPresetBannerProps = {
  presets: SettingsTourPresetDto[] | undefined;
  wizardTemplate: TenantWizardTemplate;
  /** RHF access from wizard shell — plugins must not use `useFormContext` directly. */
  formMethods: DenaliWizardHeaderPluginFormMethods;
  ruleSet: DenaliRuleSet;
  workspaceFormProfile: TourFormProfile | undefined;
  /** Called after preset hydrate + form reset (use to bump canonical sync). */
  onApplied?: (_presetId: string) => void;
  /** Reset form to workspace template baseline via factory (clear applied preset). */
  onClear?: () => void | Promise<void>;
  /** Factory orchestration failures (preset apply / clear). */
  onOrchestrationError?: (_errors: readonly string[]) => void;
  clearLabel?: string;
};

export function DenaliTourCreationPresetBanner({
  presets,
  wizardTemplate,
  formMethods,
  ruleSet,
  workspaceFormProfile,
  onApplied,
  onClear,
  onOrchestrationError,
  clearLabel,
}: DenaliTourCreationPresetBannerProps) {
  const t = useTranslations("tours.new");
  const { reset } = formMethods;

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
  const [applyBusy, setApplyBusy] = useState(false);

  useEffect(() => {
    const ids = new Set(choiceList.map((p) => p.id));
    setSelectedId((prev) => (prev && ids.has(prev) ? prev : (choiceList[0]?.id ?? "")));
  }, [choiceList]);

  const selected = useMemo(
    () => choiceList.find((p) => p.id === selectedId) ?? null,
    [choiceList, selectedId],
  );

  const appliedForCurrentChoice = selected != null && lastAppliedPresetId === selected.id;

  const applySelected = useCallback(async () => {
    if (!selected?.isActive || workspaceFormProfile == null || applyBusy) {
      return;
    }
    setApplyBusy(true);
    try {
      const result = await applyDenaliWizardPreset({
        workspaceFormProfile,
        ruleSet,
        template: wizardTemplate,
        canonicalData: selected.canonicalData,
      });
      if (!result.success) {
        onOrchestrationError?.(result.errors);
        return;
      }
      reset(result.form, DENALI_QUIET_FORM_RESET_OPTIONS);
      setLastAppliedPresetId(selected.id);
      onApplied?.(selected.id);
    } finally {
      setApplyBusy(false);
    }
  }, [
    applyBusy,
    onApplied,
    onOrchestrationError,
    reset,
    ruleSet,
    selected,
    wizardTemplate,
    workspaceFormProfile,
  ]);

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
        background: "var(--color-primary-50)",
        border: "1px solid var(--color-primary-100)",
        fontSize: "0.875rem",
        color: "var(--color-neutral-800)",
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
        <label htmlFor="workspace-wizard-preset-select" style={{ fontWeight: 600 }}>
          {t("wizardPresetSelectLabel")}
        </label>
        <Select
          id="workspace-wizard-preset-select"
          data-testid="workspace-wizard-preset-select"
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
            <span style={{ fontSize: "0.8125rem", color: "var(--color-neutral-600)" }}>
              {t("wizardPresetAppliedStatus")}
            </span>
          ) : null}
          <Button
            type="button"
            variant="primary"
            data-testid="workspace-wizard-preset-apply"
            onClick={() => {
              void applySelected();
            }}
            disabled={!selected?.isActive || workspaceFormProfile == null || applyBusy}
          >
            {t("wizardPresetApply")}
          </Button>
          {onClear ? (
            <Button
              type="button"
              variant="secondary"
              data-testid="workspace-wizard-preset-clear"
              onClick={() => {
                setLastAppliedPresetId(null);
                void onClear();
              }}
            >
              {clearLabel ?? t("wizardPresetClear")}
            </Button>
          ) : null}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--color-neutral-600)" }}>
        {selected && !selected.isActive
          ? t("wizardPresetInactiveApplyBlocked")
          : t("wizardPresetSuggestedHint")}
      </p>
    </div>
  );
}
