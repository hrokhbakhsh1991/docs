"use client";

import { useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";

import type { WorkspaceWizardDraftMeta } from "@app-tour/workspace-sdk";

import type { TourPresetResource } from "@/features/settings/settings-module-types";

import { applyTourPresetToDraft, readActiveThemeIds } from "./tour-preset-prefill-logic";
import { shouldSkipWizardTemplatePrefill } from "./tour-clone-hydrate-logic";
import { resolveTourPreset, readPresetMatchingConfig } from "./resolve-tour-preset";
import {
  PRESETS_ADVANCED_CONFIG_VERSION,
  type PresetsAdvancedPayload,
} from "@/features/settings/presets-advanced-types";
import type { TourWizardDraft } from "./tour-wizard-draft";
import type { WizardTemplateGateState } from "./wizard-template-gate-logic";

type DraftSyncLike<TEnvelope> = {
  readonly data: TEnvelope | null;
  readonly status: string;
  readonly setData: (envelope: TEnvelope) => void;
};

type UseWizardCreateSeedPrefillInput<TEnvelope, TForm extends TourWizardDraft> = {
  readonly gate: WizardTemplateGateState;
  readonly cloneTourId: string | null;
  readonly supportsTourClone: boolean;
  readonly draftSync: DraftSyncLike<TEnvelope>;
  readonly prepareEnvelope: (form: TForm, meta: WorkspaceWizardDraftMeta) => TEnvelope;
  readonly buildPrefilledForm: (gate: WizardTemplateGateState) => TForm;
  readonly buildSeedMeta: () => WorkspaceWizardDraftMeta;
  readonly shouldSkipSeed?: () => boolean;
};

/** Phase 15.2 P15-W-B1a — seed prefill when remote draft is empty. */
export function useWizardCreateSeedPrefill<TEnvelope, TForm extends TourWizardDraft>(
  input: UseWizardCreateSeedPrefillInput<TEnvelope, TForm>
): void {
  useEffect(() => {
    if (!input.gate.published) {
      return;
    }
    if (shouldSkipWizardTemplatePrefill(input.cloneTourId, input.supportsTourClone)) {
      return;
    }
    if (input.shouldSkipSeed?.()) {
      return;
    }
    if (input.draftSync.data !== null) {
      return;
    }
    if (input.draftSync.status === "SYNCING" || input.draftSync.status === "CONFLICT_RESOLVING") {
      return;
    }
    input.draftSync.setData(
      input.prepareEnvelope(input.buildPrefilledForm(input.gate), input.buildSeedMeta())
    );
  }, [
    input.gate,
    input.cloneTourId,
    input.supportsTourClone,
    input.draftSync.data,
    input.draftSync.status,
    input.draftSync.setData,
    input.prepareEnvelope,
    input.buildPrefilledForm,
    input.buildSeedMeta,
    input.shouldSkipSeed,
  ]);
}

type UseWizardCreatePresetPrefillInput<TEnvelope, TForm extends TourWizardDraft> = {
  readonly pluginId: string;
  readonly tenantId: string;
  readonly presetId: string | null;
  readonly gate: WizardTemplateGateState;
  readonly cloneTourId: string | null;
  readonly draftSync: DraftSyncLike<TEnvelope>;
  readonly draftSyncDataRef: MutableRefObject<TEnvelope | null>;
  readonly prepareEnvelope: (form: TForm, meta: WorkspaceWizardDraftMeta) => TEnvelope;
  readonly buildPrefilledForm: (gate: WizardTemplateGateState) => TForm;
  readonly buildPresetMeta: () => WorkspaceWizardDraftMeta;
  readonly onPresetAppliedChange: (applied: boolean) => void;
};

/** Phase 15.2 P15-W-B1a — URL preset prefill for create wizard. */
export function useWizardCreatePresetPrefill<TEnvelope, TForm extends TourWizardDraft>(
  input: UseWizardCreatePresetPrefillInput<TEnvelope, TForm>
): void {
  const appliedPresetIdsRef = useRef(new Set<string>());
  const onPresetAppliedChangeRef = useRef(input.onPresetAppliedChange);
  onPresetAppliedChangeRef.current = input.onPresetAppliedChange;
  const [resources, setResources] = useState<{
    scope: string;
    presets: readonly TourPresetResource[];
    activeThemeIds: readonly string[];
    config: PresetsAdvancedPayload | null;
  } | null>(null);
  const scope = JSON.stringify([input.tenantId, input.pluginId, input.presetId, input.cloneTourId]);

  useEffect(() => {
    setResources(null);
    appliedPresetIdsRef.current.clear();
    onPresetAppliedChangeRef.current(false);
    if (!input.gate.published || input.cloneTourId !== null) return;
    let cancelled = false;
    void (async () => {
      // An explicitly selected preset must not depend on advanced configuration availability.
      let config: PresetsAdvancedPayload | null = null;
      if (input.presetId === null) {
        const response = await fetch("/api/settings/tour-presets/advanced", { cache: "no-store" });
        if (!response.ok) return;
        const body = await response.json();
        if (body?.configVersion !== PRESETS_ADVANCED_CONFIG_VERSION) return;
        config = readPresetMatchingConfig(body?.payload);
        if (config?.autoMatchEnabled !== true) return;
      }
      const [presetsRes, themesRes] = await Promise.all([
        fetch("/api/settings/resources/tour_presets", { cache: "no-store" }),
        fetch("/api/settings/resources/tour_themes", { cache: "no-store" }),
      ]);
      if (!presetsRes.ok || !themesRes.ok) return;
      const presets = await presetsRes.json();
      const themes = await themesRes.json();
      if (!Array.isArray(presets.items) || !Array.isArray(themes.items)) return;
      if (
        !presets.items.every((preset: unknown) => {
          if (preset === null || typeof preset !== "object") return false;
          const entry = preset as Record<string, unknown>;
          return (
            typeof entry.id === "string" &&
            typeof entry.name === "string" &&
            typeof entry.isActive === "boolean" &&
            (entry.themeId === null || typeof entry.themeId === "string")
          );
        })
      )
        return;
      if (!cancelled)
        setResources({
          scope,
          presets: presets.items,
          activeThemeIds: readActiveThemeIds(input.pluginId, themes.items),
          config,
        });
    })().catch(() => {
      /* A failed optional prefill must not replace the current draft. */
    });
    return () => {
      cancelled = true;
    };
  }, [
    scope,
    input.tenantId,
    input.pluginId,
    input.presetId,
    input.cloneTourId,
    input.gate.published,
  ]);

  useEffect(() => {
    if (!input.gate.published || input.cloneTourId !== null || resources?.scope !== scope) return;
    if (!["IDLE", "DIRTY"].includes(input.draftSync.status)) return;
    const envelope = input.draftSyncDataRef.current as {
      form: TForm;
      meta: WorkspaceWizardDraftMeta;
    } | null;
    const base = envelope?.form ?? input.buildPrefilledForm(input.gate);
    const preset = resolveTourPreset({
      presetId: input.presetId,
      presets: resources.presets,
      config: resources.config,
      draft: base,
    });
    if (preset === null || appliedPresetIdsRef.current.has(preset.id)) return;
    const next = applyTourPresetToDraft(base, preset, resources.activeThemeIds) as TForm;
    // Mark even a no-op as considered, so later user edits are never re-filled.
    appliedPresetIdsRef.current.add(preset.id);
    if (next === base) return;
    input.draftSync.setData(input.prepareEnvelope(next, envelope?.meta ?? input.buildPresetMeta()));
    input.onPresetAppliedChange(true);
  }, [
    resources,
    scope,
    input.tenantId,
    input.presetId,
    input.gate,
    input.cloneTourId,
    input.draftSync.data,
    input.draftSync.status,
    input.draftSync.setData,
    input.draftSyncDataRef,
    input.buildPrefilledForm,
    input.prepareEnvelope,
    input.buildPresetMeta,
    input.onPresetAppliedChange,
  ]);
}
