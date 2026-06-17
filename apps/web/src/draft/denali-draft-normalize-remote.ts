import { denaliHydrateDraftEnvelope } from "@app-tour/workspace-denali/draft";

import type { NewTourWizardDraftEnvelope } from "./denali-wizard-draft-merge";

/** Strip server-only tombstones from engine data after remote hydrate (Track B B-8 / INV-2). */
export function normalizeDenaliRemoteEnvelope(
  envelope: NewTourWizardDraftEnvelope
): NewTourWizardDraftEnvelope {
  return denaliHydrateDraftEnvelope(envelope, envelope.form, envelope.meta);
}
