"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";

import { getDenaliWorkspacePlugin } from "@app-tour/workspace-denali/plugin";
import type { DraftSchemaGate } from "@app-tour/draft-engine";

import { resolveDraftUnificationV3Mode } from "@/draft/draft-unification-v3";
import { isDraftEssentiallyEmpty } from "@app-tour/workspace-denali/wizard/resolve-initial-step-index";
import { useWorkspaceDraft } from "@/draft/use-workspace-draft";
import { useWorkspaceDraftIndex } from "@/draft/use-workspace-draft-index";
import { useDenaliWizardClearDraft } from "@/draft/use-denali-wizard-clear-draft";
import { useAppSession } from "@/providers/app-session-context";
import { createTourAction } from "@/tours/create-tour.server";
import {
  hydrateCreateTourFromClone,
  resolveCloneTourId,
  shouldHydrateDraftFromRemote,
} from "@/tours/tour-clone-hydrate-logic";
import { resolvePresetId } from "@/tours/tour-preset-prefill-logic";
import {
  resolveInitialWorkspaceFormProfile,
  type WizardTemplateGateState,
} from "@/tours/wizard-template-gate-logic";
import {
  useWizardCreatePresetPrefill,
  useWizardCreateSeedPrefill,
} from "@/tours/wizard-create-prefill-hooks";
import { useWizardTemplateGate } from "@/tours/wizard-create-template-gate";
import {
  createWizardAssetSessionId,
  normalizeWizardRemoteEnvelope,
  prepareWizardDraftEnvelope,
} from "./wizard-draft-envelope-hooks";
import {
  buildDenaliCreatePrefilledForm,
  createDenaliDraftSchemaGate,
  createDenaliDraftOnPushSuccess,
  createDenaliWizardDraftSessionId,
  DENALI_CREATE_TOUR_DRAFT_KEY,
  DENALI_OPERATOR_WIZARD_DRAFT_NAMESPACE,
  denaliHydrateDraftEnvelope,
  denaliPrepareDraftEnvelope,
  isDenaliFreshStartEnvelope,
  resolveDenaliDraftConflictStrategy,
  resolveDenaliDraftMerge,
  type DenaliWizardDraftMeta,
  type NewTourWizardDraftEnvelope,
} from "./denali-wizard-draft-shell";
import {
  useDenaliCreateTourWizardCore,
  type DenaliCreateTourWizardScreen,
} from "@app-tour/workspace-denali/ui/chrome/use-create-tour-wizard-core";

export type { DenaliCreateTourWizardScreen };

/** Phase 15.2 P15-W-B1e — Denali create wizard orchestration hook (shell wiring). */
export function useDenaliCreateTourWizard() {
  const searchParams = useSearchParams();
  const session = useAppSession();
  const cloneTourId = useMemo(
    () => resolveCloneTourId(searchParams.get("clone")),
    [searchParams]
  );
  const presetId = useMemo(() => resolvePresetId(searchParams.get("preset")), [searchParams]);
  const denaliPlugin = useMemo(() => getDenaliWorkspacePlugin(), []);
  const loadDenaliPlugin = useCallback(async () => getDenaliWorkspacePlugin(), []);
  const gate = useWizardTemplateGate({
    pluginId: session.pluginId,
    loadPlugin: loadDenaliPlugin,
    initialWorkspaceFormProfile: resolveInitialWorkspaceFormProfile(denaliPlugin),
    unresolvedWorkspaceFormProfile: resolveInitialWorkspaceFormProfile,
  });
  const [draftResumeEpoch, setDraftResumeEpoch] = useState(0);
  const [presetApplied, setPresetApplied] = useState(false);

  const wizardSessionId = useMemo(
    () => createWizardAssetSessionId(denaliPlugin, createDenaliWizardDraftSessionId),
    [denaliPlugin]
  );
  const prepareEnvelope = useCallback(
    (form: ReturnType<typeof buildDenaliCreatePrefilledForm>, meta: DenaliWizardDraftMeta) =>
      prepareWizardDraftEnvelope(denaliPlugin, form, meta, denaliPrepareDraftEnvelope),
    [denaliPlugin]
  );
  const normalizeRemoteEnvelope = useCallback(
    (envelope: NewTourWizardDraftEnvelope) =>
      normalizeWizardRemoteEnvelope(denaliPlugin, envelope, (remote) =>
        denaliHydrateDraftEnvelope(remote, remote.form, remote.meta)
      ),
    [denaliPlugin]
  );
  const denaliSchemaGateRef = useRef<DraftSchemaGate<NewTourWizardDraftEnvelope> | null>(null);
  const denaliSchemaGate = useMemo(
    (): DraftSchemaGate<NewTourWizardDraftEnvelope> => (candidate, ctx) => {
      const active = denaliSchemaGateRef.current;
      if (active == null) {
        return { ok: true, value: candidate };
      }
      return active(candidate, ctx);
    },
    []
  );

  const draftSync = useWorkspaceDraft<NewTourWizardDraftEnvelope>({
    workspaceId: session.workspaceId,
    namespace: DENALI_OPERATOR_WIZARD_DRAFT_NAMESPACE,
    draftKey: DENALI_CREATE_TOUR_DRAFT_KEY,
    conflictStrategy: resolveDenaliDraftConflictStrategy(),
    merge: resolveDenaliDraftMerge(resolveDraftUnificationV3Mode()),
    onPushSuccess: createDenaliDraftOnPushSuccess(),
    hydrateFromRemote: shouldHydrateDraftFromRemote(cloneTourId, true),
    schemaGate: denaliSchemaGate,
    normalizeRemote: normalizeRemoteEnvelope,
    shouldBypassServerVersionAdoption: isDenaliFreshStartEnvelope,
  });

  const draftSyncDataRef = useRef(draftSync.data);
  draftSyncDataRef.current = draftSync.data;
  const draftIndex = useWorkspaceDraftIndex(session.workspaceId, DENALI_OPERATOR_WIZARD_DRAFT_NAMESPACE);

  const buildClearResetEnvelope = useCallback(
    () =>
      prepareEnvelope(buildDenaliCreatePrefilledForm(gate), {
        currentStepIndex: 0,
        wizardSessionId,
        freshStart: true,
      }),
    [gate, wizardSessionId, prepareEnvelope]
  );

  const clearDraft = useDenaliWizardClearDraft({
    draftSync,
    buildResetEnvelope: buildClearResetEnvelope,
    onAfterClear: () => setDraftResumeEpoch((epoch) => epoch + 1),
  });

  const buildPrefilled = useCallback(
    (gateState: WizardTemplateGateState) => buildDenaliCreatePrefilledForm(gateState),
    []
  );
  const buildSeedMeta = useCallback(
    () => ({ currentStepIndex: 0, wizardSessionId, freshStart: true as const }),
    [wizardSessionId]
  );
  const buildPresetMeta = useCallback(
    () => ({ currentStepIndex: 0, wizardSessionId }),
    [wizardSessionId]
  );

  useWizardCreateSeedPrefill({
    gate,
    cloneTourId,
    supportsTourClone: true,
    draftSync,
    prepareEnvelope,
    buildPrefilledForm: buildPrefilled,
    buildSeedMeta,
    shouldSkipSeed: () => clearDraft.clearDraftPending,
  });

  useWizardCreatePresetPrefill({
    presetId,
    gate,
    cloneTourId,
    draftSync,
    draftSyncDataRef,
    prepareEnvelope,
    buildPrefilledForm: buildPrefilled,
    buildPresetMeta,
    onPresetAppliedChange: setPresetApplied,
  });

  return useDenaliCreateTourWizardCore({
    cloneTourId,
    presetId,
    presetApplied,
    session: {
      tenantId: session.tenantId,
      workspaceId: session.workspaceId,
      pluginId: session.pluginId,
    },
    gate,
    denaliPlugin,
    draftSync,
    draftIndex,
    clearDraft,
    wizardSessionId,
    prepareEnvelope,
    denaliSchemaGateRef,
    hydrateCreateTourFromClone,
    createTourAction,
    isDraftEssentiallyEmpty,
    draftResumeEpoch,
  });
}

export { createDenaliDraftSchemaGate };
