import type { ConflictStrategy, DraftSyncPayload } from "@app-tour/draft-engine";
import type { WorkspaceWizardDraftEnvelope } from "@app-tour/workspace-sdk";

import { mergeWizardDraftEnvelope } from "@/wizard/wizard-draft-envelope-hooks";

import {
  isDraftUnificationV3ServerWins,
  resolveDraftUnificationV3Mode,
  type DraftUnificationV3Mode,
} from "./draft-unification-v3";
import { logDenaliTombstoneShadowMismatch } from "@app-tour/workspace-denali/draft";
import type { NewTourWizardDraftEnvelope } from "./denali-wizard-draft-types";

export function resolveDenaliDraftConflictStrategy(
  mode: DraftUnificationV3Mode = resolveDraftUnificationV3Mode(),
): ConflictStrategy {
  return isDraftUnificationV3ServerWins(mode) ? "SERVER_WINS" : "REFETCH_REAPPLY";
}

export function createDenaliDraftOnPushSuccess(
  mode: DraftUnificationV3Mode = resolveDraftUnificationV3Mode(),
): (
  localPayload: DraftSyncPayload<NewTourWizardDraftEnvelope>,
  serverPayload: DraftSyncPayload<NewTourWizardDraftEnvelope>,
  baselineData: NewTourWizardDraftEnvelope | undefined,
) => void {
  return (localPayload, serverPayload, baselineData) => {
    logDenaliTombstoneShadowMismatch(
      mode,
      baselineData,
      localPayload.data,
      serverPayload.data,
    );
  };
}

export function resolveWizardDraftMerge<TForm>(
  plugin: Parameters<typeof mergeWizardDraftEnvelope<TForm>>[0],
  mode: DraftUnificationV3Mode = resolveDraftUnificationV3Mode(),
  fallback?: (
    local: WorkspaceWizardDraftEnvelope<TForm>,
    server: WorkspaceWizardDraftEnvelope<TForm>,
  ) => WorkspaceWizardDraftEnvelope<TForm>
):
  | ((
      local: WorkspaceWizardDraftEnvelope<TForm>,
      server: WorkspaceWizardDraftEnvelope<TForm>,
    ) => WorkspaceWizardDraftEnvelope<TForm>)
  | undefined {
  if (isDraftUnificationV3ServerWins(mode)) {
    return undefined;
  }
  return (local, server) => mergeWizardDraftEnvelope(plugin, local, server, fallback);
}
