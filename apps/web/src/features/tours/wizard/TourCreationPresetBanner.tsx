"use client";

import { Button, Select } from "@tour/ui";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFormContext } from "react-hook-form";

import type { TourCreateFormValues } from "@/components/tours/wizard/schemas/tourCreateSchema";
import type { SettingsTourPresetDto } from "@/lib/settings-tour-presets.client";

import { mergeTourDraft } from "./tourCreateWizardMerge";
import { listAllTourWizardPresetsSorted, presetDefaultsToFormPatch } from "./tourCreationPresetMatch";

export type TourCreationPresetBannerProps = {
  presets: SettingsTourPresetDto[] | undefined;
};

export function TourCreationPresetBanner({ presets }: TourCreationPresetBannerProps) {
  const t = useTranslations("tours.new");
  const { getValues, reset } = useFormContext<TourCreateFormValues>();

  const choiceList = useMemo(() => listAllTourWizardPresetsSorted(presets), [presets]);

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
    if (!selected?.isActive) return;
    const patch = presetDefaultsToFormPatch(selected.defaults);
    const merged = mergeTourDraft(getValues(), patch);
    reset(merged);
    setLastAppliedPresetId(selected.id);
  }, [getValues, reset, selected]);

  const onSelectChange = useCallback((nextId: string) => {
    setSelectedId(nextId);
    setLastAppliedPresetId(null);
  }, []);

  if (!presets?.length || choiceList.length === 0) {
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
          <Button type="button" variant="primary" onClick={applySelected} disabled={!selected?.isActive}>
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
