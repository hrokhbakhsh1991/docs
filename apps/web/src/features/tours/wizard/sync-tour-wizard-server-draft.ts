import { patchWorkspaceTourWizardDraft } from "@/lib/settings-tour-wizard-draft.client";

import { parseWizardDraftRecord } from "./tourWizardDraftEnvelope";
import { getServerDraftRowVersion, setServerDraftRowVersion } from "./tour-wizard-server-draft-state";

let lastSyncedPayload: string | null = null;
let inFlight: Promise<void> | null = null;

/**
 * Fire-and-forget PATCH of the serialized local draft envelope (debounced by caller).
 * Skips duplicate payloads and serializes concurrent writes.
 */
export function syncTourWizardServerDraft(serializedPayload: string): void {
  const parsed = parseWizardDraftRecord(serializedPayload);
  if (!parsed) {
    return;
  }
  if (serializedPayload === lastSyncedPayload) {
    return;
  }
  const envelope = {
    ...parsed.formPatch,
    ...(parsed.wizardMeta ? { _wizardMeta: parsed.wizardMeta } : {}),
  } as Record<string, unknown>;

  const run = async (): Promise<void> => {
    try {
      const res = await patchWorkspaceTourWizardDraft({
        envelope,
        rowVersion: getServerDraftRowVersion(),
      });
      if (res.draft?.rowVersion != null) {
        setServerDraftRowVersion(res.draft.rowVersion);
      }
      lastSyncedPayload = serializedPayload;
    } catch {
      /* ignore — localStorage remains source of truth */
    } finally {
      inFlight = null;
    }
  };

  if (inFlight) {
    void inFlight.then(run);
    return;
  }
  inFlight = run();
}
