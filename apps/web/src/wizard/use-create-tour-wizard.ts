"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";

import type { DraftSchemaGate } from "@app-tour/draft-engine";
import type { WorkspacePlugin, WorkspaceWizardDraftMeta } from "@app-tour/workspace-sdk";

import { resolveDraftUnificationV3Mode } from "@/draft/draft-unification-v3";
import { createDeferredDraftSchemaGate } from "@/draft/create-deferred-draft-schema-gate";
import { useWorkspaceDraft } from "@/draft/use-workspace-draft";
import { useWorkspaceDraftIndex } from "@/draft/use-workspace-draft-index";
import { useWizardClearDraft } from "@/draft/use-wizard-clear-draft";
import { useAppSession } from "@/providers/app-session-context";
import { createTourAction } from "@/tours/create-tour.server";
import { createCreateTourPostSubmitDiscardRemoteDraft } from "@/tours/create-tour-post-submit-discard";
import { runCreateTourPostSubmitSuccess } from "@/tours/run-create-tour-post-submit-success";
import {
  hydrateCreateTourFromClone,
  resolveCloneTourId,
  shouldHydrateDraftFromRemote,
} from "@/tours/tour-clone-hydrate-logic";
import { resolvePresetId } from "@/tours/tour-preset-prefill-logic";
import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
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
  buildCreatePrefilledFormForPlugin,
  createDraftSchemaGateForPlugin,
  createOperatorDraftOnPushSuccess,
  createWizardDraftSessionIdForPlugin,
  isDraftEssentiallyEmptyForPlugin,
  isFreshStartEnvelopeForPlugin,
  resolveCreateTourDraftIdentityForPlugin,
  resolveDraftMergeForPlugin,
  resolveOperatorDraftConflictStrategy,
  type OperatorWizardDraftMeta,
  type NewTourWizardDraftEnvelope,
} from "./wizard-draft-shell";
import { useWorkspaceIntegrationRuntimeState } from "@/integrations/use-workspace-integration-runtime-state";
import { loadWizardWorkspacePlugin } from "./resolve-wizard-workspace-plugin";
import {
  buildWizardFreshStartMeta,
  buildWizardStepZeroMeta,
  buildCreateTourDiscardRemoteDraftInput,
  createTourRemoteDraftIdentity,
  prepareCreateTourFreshStartEnvelope,
} from "./wizard-host-adapter-registry";
import {
  useOperatorCreateTourWizardCore,
  type OperatorCreateTourWizardScreen,
} from "./wizard-create-chrome-registry";

type OperatorCreateTourWizardCoreState = // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any;

export type { OperatorCreateTourWizardScreen };

/**
 * Operator create wizard orchestration (shell wiring).
 * Plugin must be loaded by the page client via {@link loadWizardWorkspacePlugin}(session.pluginId).
 * @see docs/dev/wave-i-9-create-wizard-async-plugin.mdoc
 */
export function useOperatorCreateTourWizard(options: {
  readonly plugin: WorkspacePlugin;
  readonly initialTemplateResponse?: unknown | null;
}): OperatorCreateTourWizardCoreState {
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = useAppSession();
  const cloneTourId = useMemo(() => resolveCloneTourId(searchParams.get("clone")), [searchParams]);
  const presetId = useMemo(() => resolvePresetId(searchParams.get("preset")), [searchParams]);
  const wizardPlugin = options.plugin;
  const supportsTourClone = wizardPlugin.tourClone != null;
  const loadWizardPlugin = useCallback(
    async () => loadWizardWorkspacePlugin(session.pluginId),
    [session.pluginId]
  );
  const gate = useWizardTemplateGate({
    pluginId: session.pluginId,
    loadPlugin: loadWizardPlugin,
    initialWorkspaceFormProfile: resolveInitialWorkspaceFormProfile(wizardPlugin),
    unresolvedWorkspaceFormProfile: resolveInitialWorkspaceFormProfile,
    initialTemplateResponse: options.initialTemplateResponse ?? null,
  });
  const integrationRuntime = useWorkspaceIntegrationRuntimeState(session.workspaceId);
  const [draftResumeEpoch, setDraftResumeEpoch] = useState(0);
  const [presetApplied, setPresetApplied] = useState(false);

  const wizardSessionId = useMemo(
    () =>
      createWizardAssetSessionId(wizardPlugin, () =>
        createWizardDraftSessionIdForPlugin(wizardPlugin)
      ),
    [wizardPlugin]
  );
  const prepareEnvelope = useCallback(
    (form: TourWizardDraft, meta: OperatorWizardDraftMeta) =>
      prepareWizardDraftEnvelope(wizardPlugin, form, meta, () => {
        throw new Error(
          `wizardHost.prepareDraftEnvelope missing for plugin ${wizardPlugin.id}`
        );
      }) as NewTourWizardDraftEnvelope,
    [wizardPlugin]
  );
  const normalizeRemoteEnvelope = useCallback(
    (envelope: NewTourWizardDraftEnvelope) =>
      normalizeWizardRemoteEnvelope(wizardPlugin, envelope, () => {
        throw new Error(
          `wizardHost.normalizeRemoteEnvelope missing for plugin ${wizardPlugin.id}`
        );
      }),
    [wizardPlugin]
  );
  const draftSchemaGateRef = useRef<DraftSchemaGate<NewTourWizardDraftEnvelope> | null>(null);
  const draftSchemaGate = useMemo(
    () => createDeferredDraftSchemaGate(draftSchemaGateRef),
    []
  );

  const draftMergeFn = resolveDraftMergeForPlugin(
    wizardPlugin,
    resolveDraftUnificationV3Mode()
  );
  const createTourDraftIdentity =
    resolveCreateTourDraftIdentityForPlugin(wizardPlugin) ??
    createTourRemoteDraftIdentity(wizardPlugin.id);

  const draftSync = useWorkspaceDraft<NewTourWizardDraftEnvelope>({
    workspaceId: session.workspaceId,
    namespace: createTourDraftIdentity.namespace,
    draftKey: createTourDraftIdentity.draftKey,
    conflictStrategy: resolveOperatorDraftConflictStrategy(),
    merge: draftMergeFn
      ? (local, server) =>
          draftMergeFn(local as never, server as never) as NewTourWizardDraftEnvelope
      : undefined,
    onPushSuccess: createOperatorDraftOnPushSuccess(wizardPlugin),
    hydrateFromRemote: shouldHydrateDraftFromRemote(cloneTourId, supportsTourClone),
    schemaGate: draftSchemaGate,
    normalizeRemote: normalizeRemoteEnvelope,
    shouldBypassServerVersionAdoption: (envelope) =>
      isFreshStartEnvelopeForPlugin(wizardPlugin, envelope),
  });

  const draftSyncDataRef = useRef(draftSync.data);
  draftSyncDataRef.current = draftSync.data;
  const draftIndex = useWorkspaceDraftIndex(
    session.workspaceId,
    createTourDraftIdentity.namespace
  );

  const buildClearResetEnvelope = useCallback(
    () =>
      prepareCreateTourFreshStartEnvelope(
        wizardPlugin.id,
        prepareEnvelope as never,
        buildCreatePrefilledFormForPlugin(wizardPlugin, gate) as TourWizardDraft,
        wizardSessionId
      ),
    [gate, wizardSessionId, prepareEnvelope, wizardPlugin]
  );

  const clearDraft = useWizardClearDraft({
    draftSync,
    buildResetEnvelope: buildClearResetEnvelope,
    onAfterClear: () => setDraftResumeEpoch((epoch) => epoch + 1),
  });

  const buildPrefilled = useCallback(
    (gateState: WizardTemplateGateState) =>
      buildCreatePrefilledFormForPlugin(wizardPlugin, gateState) as TourWizardDraft,
    [wizardPlugin]
  );
  const buildSeedMeta = useCallback(
    () => buildWizardFreshStartMeta(wizardPlugin.id, wizardSessionId),
    [wizardPlugin.id, wizardSessionId]
  );
  const buildPresetMeta = useCallback(
    () => buildWizardStepZeroMeta(wizardPlugin.id, wizardSessionId),
    [wizardPlugin.id, wizardSessionId]
  );

  const prepareEnvelopeForPrefill = useCallback(
    (form: TourWizardDraft, meta: WorkspaceWizardDraftMeta) =>
      prepareEnvelope(form, meta as OperatorWizardDraftMeta),
    [prepareEnvelope]
  );

  useWizardCreateSeedPrefill({
    gate,
    cloneTourId,
    supportsTourClone,
    draftSync,
    prepareEnvelope: prepareEnvelopeForPrefill,
    buildPrefilledForm: buildPrefilled,
    buildSeedMeta,
    shouldSkipSeed: () => clearDraft.clearDraftPending,
  });

  useWizardCreatePresetPrefill({
    pluginId: wizardPlugin.id,
    presetId,
    gate,
    cloneTourId,
    draftSync,
    draftSyncDataRef,
    prepareEnvelope: prepareEnvelopeForPrefill,
    buildPrefilledForm: buildPrefilled,
    buildPresetMeta,
    onPresetAppliedChange: setPresetApplied,
  });

  const onCreateSuccess = useCallback(
    (tourId: string) => {
      runCreateTourPostSubmitSuccess({
        tourId,
        navigate: (url) => router.replace(url),
        discardRemoteDraft: createCreateTourPostSubmitDiscardRemoteDraft(
          buildCreateTourDiscardRemoteDraftInput(wizardPlugin.id, session.workspaceId)
        ),
      });
    },
    [router, session.workspaceId, wizardPlugin.id]
  );

  return useOperatorCreateTourWizardCore({
    cloneTourId,
    presetId,
    presetApplied,
    session: {
      tenantId: session.tenantId,
      workspaceId: session.workspaceId,
      pluginId: session.pluginId,
    },
    gate,
    runtimeGates: integrationRuntime,
    denaliPlugin: wizardPlugin,
    draftSync,
    draftIndex,
    clearDraft,
    wizardSessionId,
    prepareEnvelope,
    // Product core still expects this branded prop key (Gap Closure B.11 residual).
    draftSchemaGateRef,
    hydrateCreateTourFromClone,
    createTourAction,
    isDraftEssentiallyEmpty: (form: Record<string, unknown>) =>
      isDraftEssentiallyEmptyForPlugin(wizardPlugin, form),
    draftResumeEpoch,
    onCreateSuccess,
  } as unknown as Parameters<typeof useOperatorCreateTourWizardCore>[0]);
}

export { createDraftSchemaGateForPlugin };
