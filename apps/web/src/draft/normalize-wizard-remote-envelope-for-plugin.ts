import type { WorkspacePlugin } from "@app-tour/workspace-sdk";

import type { NewTourWizardDraftEnvelope } from "@/draft/tour-wizard-draft-envelope";
import { normalizeWizardRemoteEnvelope } from "@/wizard/wizard-draft-envelope-hooks";

/** Strip server-only tombstones from engine data after remote hydrate (Track B B-8 / INV-2). */
export function normalizeWizardRemoteEnvelopeForPlugin(
  plugin: WorkspacePlugin,
  envelope: NewTourWizardDraftEnvelope
): NewTourWizardDraftEnvelope {
  return normalizeWizardRemoteEnvelope(plugin, envelope, () => {
    throw new Error(`WIZARD_NORMALIZE_REMOTE_HOOK_MISSING:${plugin.id}`);
  });
}
