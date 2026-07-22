"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { DraftSchemaGate } from "@app-tour/draft-engine";
import type { UpdateTourPayload, WorkspacePlugin } from "@app-tour/workspace-sdk";

import { isOwnerRole, type OperatorSessionContext } from "@/admin/require-operator-session";
import { createDeferredDraftSchemaGate } from "@/draft/create-deferred-draft-schema-gate";
import type { NewTourWizardDraftEnvelope } from "@/draft/tour-wizard-draft-envelope";
import { resolveDraftUnificationV3Mode } from "@/draft/draft-unification-v3";
import {
  createOperatorDraftOnPushSuccess,
  resolveOperatorDraftConflictStrategy,
} from "@/draft/draft-unification-v3-options";
import { normalizeWizardRemoteEnvelopeForPlugin } from "@/draft/normalize-wizard-remote-envelope-for-plugin";
import { useWorkspaceDraft } from "@/draft/use-workspace-draft";
import {
  createLoadingWizardTemplateGateState,
  createUnpublishedWizardTemplateGateState,
  resolveWizardTemplateGateState,
  type WizardTemplateGateState,
} from "@/tours/wizard-template-gate-logic";
import { useAppSession } from "@/providers/app-session-context";
import { useWorkspaceIntegrationRuntimeState } from "@/integrations/use-workspace-integration-runtime-state";
import {
  createOperatorDraftSchemaGate,
  createOperatorWizardDraftSessionId,
  resolveOperatorDraftMerge,
} from "./draft-shell-runtime";
import {
  buildWizardStepZeroMeta,
  editTourRemoteDraftIdentity,
} from "./host-adapter-runtime";
import {
  loadOperatorSubmitCatalogIds,
  useOperatorFlatEditPageCore,
} from "./wizard-chrome-runtime";
import type { OperatorFlatEditPageIo } from "./operator-flat-edit-page-io";
import { webOperatorFlatEditPageIo } from "./web-operator-flat-edit-page-io";

type OperatorFlatEditPageCoreState = // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any;

/** Neutral loading profile — real profile comes from template fetch (Wave B.b.1). */
const INITIAL_GATE: WizardTemplateGateState =
  createLoadingWizardTemplateGateState("platform_default");

export type UseOperatorFlatEditPageInput = {
  readonly session: OperatorSessionContext;
  readonly tourId: string;
  /** Loaded by the page client via {@link loadWizardWorkspacePlugin} (Wave B.c). */
  readonly plugin: WorkspacePlugin;
  /** Defaults to {@link webOperatorFlatEditPageIo} (P2-D4.a). */
  readonly io?: OperatorFlatEditPageIo;
};

/** Phase 15.2 / P2-D4.a / Wave B.c — operator flat-edit orchestration (shell wiring + injected I/O + plugin). */
export function useOperatorFlatEditPage({
  session,
  tourId,
  plugin,
  io = webOperatorFlatEditPageIo,
}: UseOperatorFlatEditPageInput): OperatorFlatEditPageCoreState & {
  readonly draftSyncEngine: ReturnType<typeof useWorkspaceDraft<NewTourWizardDraftEnvelope>>;
} {
  const appSession = useAppSession();
  const router = useRouter();
  const wizardSessionId = useMemo(() => createOperatorWizardDraftSessionId(), []);
  const editTourDraftIdentity = useMemo(
    () => editTourRemoteDraftIdentity(tourId),
    [tourId]
  );
  const envelopeMeta = useMemo(
    () => buildWizardStepZeroMeta(wizardSessionId),
    [wizardSessionId]
  );
  const draftSchemaGateRef = useRef<DraftSchemaGate<NewTourWizardDraftEnvelope> | null>(null);
  const draftSchemaGate = useMemo(
    () => createDeferredDraftSchemaGate(draftSchemaGateRef),
    []
  );

  const draftMergeFn = resolveOperatorDraftMerge(resolveDraftUnificationV3Mode());

  const draftSync = useWorkspaceDraft<NewTourWizardDraftEnvelope>({
    workspaceId: appSession.workspaceId,
    namespace: editTourDraftIdentity.namespace,
    draftKey: editTourDraftIdentity.draftKey,
    conflictStrategy: resolveOperatorDraftConflictStrategy(),
    merge: draftMergeFn
      ? (local, server) =>
          draftMergeFn(local as never, server as never) as NewTourWizardDraftEnvelope
      : undefined,
    onPushSuccess: createOperatorDraftOnPushSuccess(),
    schemaGate: draftSchemaGate,
    normalizeRemote: (envelope) => normalizeWizardRemoteEnvelopeForPlugin(plugin, envelope),
  });

  const [gate, setGate] = useState<WizardTemplateGateState>(INITIAL_GATE);
  const integrationRuntime = useWorkspaceIntegrationRuntimeState(appSession.workspaceId);

  useEffect(() => {
    let cancelled = false;
    void io
      .loadWizardTemplatePayload()
      .then((payload) => {
        if (!cancelled) {
          setGate(resolveWizardTemplateGateState(payload, session.pluginId));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGate(
            createUnpublishedWizardTemplateGateState(INITIAL_GATE.workspaceFormProfile)
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [io, session.pluginId]);

  const loadTourBaseline = useCallback(
    async (loadTourId: string) => io.loadTourBaseline({ tourId: loadTourId, plugin }),
    [io, plugin]
  );

  const updateTour = useCallback(
    async (payload: UpdateTourPayload) => io.updateTour(tourId, payload),
    [io, tourId]
  );

  const onAfterPatchSuccess = useCallback(() => {
    router.refresh();
  }, [router]);

  const core = useOperatorFlatEditPageCore({
    tourId,
    tenantId: session.tenantId,
    canPublish: isOwnerRole(session.role),
    gate,
    runtimeGates: integrationRuntime,
    plugin,
    draftSync,
    draftSchemaGateRef,
    envelopeMeta,
    wizardSessionId,
    loadTourBaseline,
    updateTour,
    loadSubmitCatalog: loadOperatorSubmitCatalogIds,
    onAfterPatchSuccess,
  } as unknown as Parameters<typeof useOperatorFlatEditPageCore>[0]) as OperatorFlatEditPageCoreState;

  return { ...core, draftSyncEngine: draftSync };
}

export { createOperatorDraftSchemaGate };
