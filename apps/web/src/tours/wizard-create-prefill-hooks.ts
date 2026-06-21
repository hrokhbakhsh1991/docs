"use client";

import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";

import type { WorkspaceWizardDraftMeta } from "@app-tour/workspace-sdk";

import type { TourPresetResource, TourThemeResource } from "@/features/settings/settings-module-types";

import {
  applyTourPresetToDraft,
  findActiveTourPreset,
  readActiveThemeIds,
} from "./tour-preset-prefill-logic";
import { shouldSkipWizardTemplatePrefill } from "./tour-clone-hydrate-logic";
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
  const appliedPresetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!input.presetId || !input.gate.published || input.cloneTourId !== null) {
      appliedPresetIdRef.current = null;
      input.onPresetAppliedChange(false);
      return;
    }
    if (appliedPresetIdRef.current === input.presetId) {
      return;
    }

    let cancelled = false;
    void Promise.all([
      fetch("/api/settings/resources/tour_presets", { cache: "no-store" }),
      fetch("/api/settings/resources/tour_themes", { cache: "no-store" }),
    ])
      .then(async ([presetsRes, themesRes]) => {
        if (!presetsRes.ok) {
          return null;
        }
        const presetsPayload = (await presetsRes.json()) as { items?: readonly TourPresetResource[] };
        const themesPayload = themesRes.ok
          ? ((await themesRes.json()) as { items?: readonly TourThemeResource[] })
          : { items: [] as readonly TourThemeResource[] };
        const preset = findActiveTourPreset(presetsPayload.items ?? [], input.presetId!);
        if (preset == null) {
          return null;
        }
        const activeThemeIds = readActiveThemeIds(themesPayload.items ?? []);
        return { preset, activeThemeIds };
      })
      .then((resolved) => {
        if (cancelled || resolved == null) {
          return;
        }
        appliedPresetIdRef.current = input.presetId;
        const applyPreset = (base: TForm) =>
          applyTourPresetToDraft(base, resolved.preset, resolved.activeThemeIds) as TForm;
        const currentEnvelope = input.draftSyncDataRef.current;
        if (currentEnvelope != null) {
          const envelope = currentEnvelope as { form: TForm; meta: WorkspaceWizardDraftMeta };
          input.draftSync.setData(
            input.prepareEnvelope(applyPreset(envelope.form), envelope.meta)
          );
        } else {
          input.draftSync.setData(
            input.prepareEnvelope(applyPreset(input.buildPrefilledForm(input.gate)), input.buildPresetMeta())
          );
        }
        input.onPresetAppliedChange(true);
      })
      .catch(() => {
        if (!cancelled) {
          input.onPresetAppliedChange(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    input.presetId,
    input.gate,
    input.cloneTourId,
    input.draftSync.setData,
    input.prepareEnvelope,
    input.buildPrefilledForm,
    input.buildPresetMeta,
    input.onPresetAppliedChange,
    input.draftSyncDataRef,
  ]);
}
