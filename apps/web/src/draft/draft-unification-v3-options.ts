import type { ConflictStrategy, DraftSyncPayload } from "@app-tour/draft-engine";

import { mergeDenaliWizardDraftEnvelope, type NewTourWizardDraftEnvelope } from "./denali-wizard-draft-merge";
import {
  isDraftUnificationV3ServerWins,
  resolveDraftUnificationV3Mode,
  type DraftUnificationV3Mode,
} from "./draft-unification-v3";
import { logDenaliTombstoneShadowMismatch } from "./draft-unification-v3-shadow";

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

export function resolveDenaliDraftMerge(
  mode: DraftUnificationV3Mode = resolveDraftUnificationV3Mode(),
):
  | ((
      local: NewTourWizardDraftEnvelope,
      server: NewTourWizardDraftEnvelope,
    ) => NewTourWizardDraftEnvelope)
  | undefined {
  if (isDraftUnificationV3ServerWins(mode)) {
    return undefined;
  }
  return mergeDenaliWizardDraftEnvelope;
}
