import { resolveBootstrapWorkspacePlugin } from "@/bootstrap/resolve-bootstrap-workspace-plugin";

import type { NewTourWizardDraftEnvelope } from "./denali-wizard-draft-merge";
import { normalizeWizardRemoteEnvelope } from "@/wizard/wizard-draft-envelope-hooks";

/** Strip server-only tombstones from engine data after remote hydrate (Track B B-8 / INV-2). */
export function normalizeDenaliRemoteEnvelope(
  envelope: NewTourWizardDraftEnvelope
): NewTourWizardDraftEnvelope {
  const plugin = resolveBootstrapWorkspacePlugin("denali");
  return normalizeWizardRemoteEnvelope(plugin, envelope, () => {
    throw new Error("DENALI_WIZARD_NORMALIZE_REMOTE_HOOK_MISSING");
  });
}
