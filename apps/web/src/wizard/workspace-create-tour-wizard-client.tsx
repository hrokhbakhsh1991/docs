"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import {
  encodeTourActionSubmitErrorForPlugin,
} from "@/wizard/tour-action-submit-codec";
import {
  resolveWizardHostCapability,
  type WorkspacePlugin,
  type WorkspaceWizardDraftMeta,
} from "@app-tour/workspace-sdk";

import { DraftSyncChrome } from "@/draft/draft-sync-chrome";
import { resolveDraftUnificationV3Mode } from "@/draft/draft-unification-v3";
import { resolveWizardDraftMerge } from "@/draft/draft-unification-v3-options";
import { useWorkspaceDraft } from "@/draft/use-workspace-draft";
import { useAppSession } from "@/providers/app-session-context";
import { createTourAction } from "@/tours/create-tour.server";
import { createCreateTourPostSubmitDiscardRemoteDraft } from "@/tours/create-tour-post-submit-discard";
import { runCreateTourPostSubmitSuccess } from "@/tours/run-create-tour-post-submit-success";
import { emptyTourWizardDraft, type TourWizardDraft } from "@/tours/tour-wizard-draft";
import {
  resolveCloneTourId,
  shouldHydrateDraftFromRemote,
  shouldSkipWizardTemplatePrefill,
} from "@/tours/tour-clone-hydrate-logic";
import { resolvePresetId } from "@/tours/tour-preset-prefill-logic";
import type { WizardTemplateGateState } from "@/tours/wizard-template-gate-logic";
import { applyWizardTemplatePrefillToDraft } from "@/tours/wizard-template-prefill-logic";
import {
  useWizardCreatePresetPrefill,
  useWizardCreateSeedPrefill,
} from "@/tours/wizard-create-prefill-hooks";
import { useWizardTemplateGate } from "@/tours/wizard-create-template-gate";
import {
  CreateTourWizardLoadingMessage,
  CreateTourWizardNotConfigured,
  CreateTourWizardPageHeader,
  CreateTourWizardPresetBanner,
  CreateTourWizardSeedBanner,
  CreateTourWizardSubmitFooter,
} from "@/wizard/create-tour-wizard-chrome";
import { loadWorkspacePluginById } from "@/wizard/load-workspace-plugin";
import {
  createPlatformWizardDraftEnvelope,
  PLATFORM_OPERATOR_WIZARD_DRAFT_NAMESPACE,
  platformCreateTourDraftKey,
  type PlatformCreateTourDraftEnvelope,
} from "@/wizard/platform-wizard-draft-binding";
import {
  normalizeWizardRemoteEnvelope,
  prepareWizardDraftEnvelope,
} from "@/wizard/wizard-draft-envelope-hooks";
import { WorkspaceWizardHost } from "@/wizard/workspace-wizard-host";
import { createWizardSubmitErrorTranslator } from "@/wizard/create-wizard-submit-error-translator";
import { resolveWizardSubmitErrorMessage } from "@/wizard/resolve-wizard-submit-error-message";

function buildPrefilledForm(
  gate: WizardTemplateGateState,
  pluginId: string,
  plugin?: WorkspacePlugin | null
): TourWizardDraft {
  return applyWizardTemplatePrefillToDraft(
    emptyTourWizardDraft(),
    gate.seedLabel,
    gate.fieldOverlays,
    pluginId,
    plugin ?? undefined
  );
}

export type WorkspaceCreateTourWizardClientProps = {
  readonly pluginId: string;
};

/** Phase 14.3 — shared create-tour orchestrator for non-extended-chrome workspaces. */
export function WorkspaceCreateTourWizardClient({ pluginId }: WorkspaceCreateTourWizardClientProps) {
  const t = useTranslations("wizard");
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = useAppSession();
  const cloneTourId = useMemo(
    () => resolveCloneTourId(searchParams.get("clone")),
    [searchParams]
  );
  const presetId = useMemo(() => resolvePresetId(searchParams.get("preset")), [searchParams]);
  const [workspacePlugin, setWorkspacePlugin] = useState<WorkspacePlugin | null>(null);
  const [supportsTourClone, setSupportsTourClone] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const resolveSubmitError = useCallback(
    (code: string) =>
      resolveWizardSubmitErrorMessage({
        pluginId,
        raw: code,
        context: "create",
        translateFieldLabel: (path) => path,
        t: createWizardSubmitErrorTranslator(t),
      }),
    [t, pluginId]
  );
  const [createdTourId, setCreatedTourId] = useState<string | null>(null);
  const [presetApplied, setPresetApplied] = useState(false);
  const [pending, startTransition] = useTransition();

  const loadPlugin = useCallback(() => loadWorkspacePluginById(pluginId), [pluginId]);
  const gate = useWizardTemplateGate({
    pluginId,
    loadPlugin,
    initialWorkspaceFormProfile: "platform_default",
    unresolvedWorkspaceFormProfile: () => "platform_default",
  });

  useEffect(() => {
    let cancelled = false;
    void loadWorkspacePluginById(pluginId).then((plugin) => {
      if (!cancelled) {
        setWorkspacePlugin(plugin);
        setSupportsTourClone(plugin.tourClone != null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pluginId]);

  const prepareEnvelope = useCallback(
    (form: TourWizardDraft, meta: WorkspaceWizardDraftMeta): PlatformCreateTourDraftEnvelope =>
      workspacePlugin != null
        ? prepareWizardDraftEnvelope(
            workspacePlugin,
            form,
            meta,
            createPlatformWizardDraftEnvelope
          )
        : createPlatformWizardDraftEnvelope(form, meta),
    [workspacePlugin]
  );

  const normalizeRemote = useCallback(
    (envelope: PlatformCreateTourDraftEnvelope): PlatformCreateTourDraftEnvelope =>
      workspacePlugin != null
        ? normalizeWizardRemoteEnvelope(workspacePlugin, envelope, (remote) => remote)
        : envelope,
    [workspacePlugin]
  );

  const mergeEnvelope = useMemo(
    () =>
      workspacePlugin != null
        ? resolveWizardDraftMerge(workspacePlugin, resolveDraftUnificationV3Mode())
        : undefined,
    [workspacePlugin]
  );

  const draftSync = useWorkspaceDraft<PlatformCreateTourDraftEnvelope>({
    workspaceId: session.workspaceId,
    namespace: PLATFORM_OPERATOR_WIZARD_DRAFT_NAMESPACE,
    draftKey: platformCreateTourDraftKey(pluginId),
    conflictStrategy: "REFETCH_REAPPLY",
    merge: mergeEnvelope
      ? (local, server) =>
          mergeEnvelope(local, server) as PlatformCreateTourDraftEnvelope
      : undefined,
    hydrateFromRemote: shouldHydrateDraftFromRemote(cloneTourId, supportsTourClone),
    normalizeRemote,
  });

  const draftSyncDataRef = useRef(draftSync.data);
  draftSyncDataRef.current = draftSync.data;

  const buildPrefilled = useCallback(
    (gateState: WizardTemplateGateState) =>
      buildPrefilledForm(gateState, pluginId, workspacePlugin),
    [pluginId, workspacePlugin]
  );

  const buildSeedMeta = useCallback(
    (): WorkspaceWizardDraftMeta => ({ currentStepIndex: 0, freshStart: true }),
    []
  );

  const buildPresetMeta = useCallback(
    (): WorkspaceWizardDraftMeta => ({ currentStepIndex: 0, freshStart: true }),
    []
  );

  useWizardCreateSeedPrefill({
    gate,
    cloneTourId,
    supportsTourClone,
    draftSync,
    prepareEnvelope,
    buildPrefilledForm: buildPrefilled,
    buildSeedMeta,
  });

  useWizardCreatePresetPrefill({
    pluginId,
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

  const draftReady = draftSync.data !== null || draftSync.status === "ERROR";

  const draft = draftSync.data?.form ?? emptyTourWizardDraft();
  const activeStepIndex =
    typeof draftSync.data?.meta.currentStepIndex === "number"
      ? draftSync.data.meta.currentStepIndex
      : 0;

  const onDraftChange = useCallback(
    (next: TourWizardDraft) => {
      const envelope = draftSyncDataRef.current;
      if (envelope == null) {
        draftSync.setData(
          prepareEnvelope(next, { currentStepIndex: 0, freshStart: true })
        );
        return;
      }
      draftSync.setData(prepareEnvelope(next, envelope.meta));
    },
    [draftSync, prepareEnvelope]
  );

  const onActiveStepIndexChange = useCallback(
    (index: number) => {
      const envelope = draftSyncDataRef.current;
      if (envelope == null) {
        return;
      }
      if (envelope.meta.currentStepIndex === index) {
        return;
      }
      draftSync.setData(
        prepareEnvelope(envelope.form, {
          ...envelope.meta,
          currentStepIndex: index,
        })
      );
    },
    [draftSync, prepareEnvelope]
  );

  const showSeedBanner =
    gate.seedLabel.length > 0 &&
    !shouldSkipWizardTemplatePrefill(cloneTourId, supportsTourClone);

  const onSubmit = () => {
    setSubmitError(null);
    startTransition(async () => {
      const plugin = workspacePlugin ?? (await loadWorkspacePluginById(pluginId));
      const wizardHost = resolveWizardHostCapability(plugin);
      const payload =
        wizardHost?.prepareSubmitPayload != null
          ? wizardHost.prepareSubmitPayload({
              plugin,
              draft: draft as unknown as Readonly<Record<string, unknown>>,
              rulesModule: null,
              evalContext: {
                uiOptions: { workspaceFormProfile: gate.workspaceFormProfile },
              },
            })
          : { data: draft.data };
      const result = await createTourAction(payload as { data: typeof draft.data });
      if (!result.ok) {
        setSubmitError(
          encodeTourActionSubmitErrorForPlugin(plugin, {
            status: result.status,
            code: result.code,
            message: result.message,
          })
        );
        return;
      }
      setCreatedTourId(result.record.id);
      runCreateTourPostSubmitSuccess({
        tourId: result.record.id,
        navigate: (url) => router.replace(url),
        discardRemoteDraft: createCreateTourPostSubmitDiscardRemoteDraft({
          workspaceId: session.workspaceId,
          namespace: PLATFORM_OPERATOR_WIZARD_DRAFT_NAMESPACE,
          draftKey: platformCreateTourDraftKey(pluginId),
        }),
      });
    });
  };

  if (gate.loading) {
    return <CreateTourWizardLoadingMessage />;
  }

  if (!gate.published) {
    return <CreateTourWizardNotConfigured />;
  }

  if (!draftReady) {
    return (
      <CreateTourWizardLoadingMessage
        testId="wizard-draft-hydrate-loading"
      />
    );
  }

  return (
    <div className="new-tour-wizard-page" data-new-tour-wizard data-workspace-create-orchestrator>
      <CreateTourWizardPageHeader
        actions={
          <DraftSyncChrome
            status={draftSync.status}
            schemaIssues={draftSync.schemaIssues}
            navLocked={draftSync.navLocked}
            pendingDraft={draftSync.pendingDraft}
            conflictReloadNotice={draftSync.conflictReloadNotice}
            onRetry={() => void draftSync.retry()}
            onFlush={() => void draftSync.flush()}
            onApplyPending={draftSync.applyDraft}
            onDiscardPending={() => {
              if (draftSync.pendingDraft != null) {
                draftSync.setData(draftSync.pendingDraft.data, { source: "remote" });
              }
            }}
            canRevertQuarantine={draftSync.canRevertQuarantine}
            onRevertQuarantine={draftSync.revertToLastValid}
            rowClassName="new-tour-wizard-page__header-actions flex flex-wrap items-center gap-2"
          />
        }
      />
      {showSeedBanner ? <CreateTourWizardSeedBanner seedLabel={gate.seedLabel} /> : null}
      {presetApplied && presetId ? <CreateTourWizardPresetBanner presetId={presetId} /> : null}
      <WorkspaceWizardHost
        pluginId={pluginId}
        tenantId={session.tenantId}
        workspaceId={session.workspaceId}
        authz={session.authz}
        draft={draft}
        onDraftChange={onDraftChange}
        allowedCanonicalPaths={gate.allowedCanonicalPaths}
        templateSteps={gate.templateSteps}
        activeStepIndex={activeStepIndex}
        onActiveStepIndexChange={onActiveStepIndexChange}
        navLocked={draftSync.navLocked}
        draftSyncStatus={draftSync.status}
        wizardRuleEvalContext={{
          uiOptions: { workspaceFormProfile: gate.workspaceFormProfile },
        }}
        renderFooter={() => (
          <CreateTourWizardSubmitFooter
            pending={pending}
            submitError={submitError}
            createdTourId={createdTourId}
            onSubmit={onSubmit}
            resolveSubmitError={resolveSubmitError}
          />
        )}
      />
    </div>
  );
}
