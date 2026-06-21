import type { WorkspacePlugin } from "@app-tour/workspace-sdk";

import { getDenaliWorkspacePlugin } from "../denali.plugin";
import type { DenaliTourWizardDraft } from "./denali-tour-wizard-draft";
import type { DenaliWizardDraftEnvelope } from "./denali-wizard-draft-binding";
import { mergeDenaliWizardDraftEnvelope } from "./merge-envelope";

export type DenaliDraftUnificationV3Mode = "off" | "shadow" | "on";

type DenaliMergeEnvelope = DenaliWizardDraftEnvelope<DenaliTourWizardDraft>;

export function isDenaliDraftUnificationV3ServerWins(mode: DenaliDraftUnificationV3Mode): boolean {
  return mode === "on";
}

/** Merge via wizardHost when present; otherwise Denali envelope merge fallback. */
export function mergeDenaliDraftViaPlugin(
  plugin: WorkspacePlugin,
  local: DenaliMergeEnvelope,
  server: DenaliMergeEnvelope,
): DenaliMergeEnvelope {
  const merge = plugin.wizardHost?.mergeDraftEnvelope;
  if (merge != null) {
    return merge(local, server) as DenaliMergeEnvelope;
  }
  return mergeDenaliWizardDraftEnvelope(local, server) as DenaliMergeEnvelope;
}

/** Phase 15.2 P15-W-B2 — Denali draft merge without per-callsite fallback arg. */
export function resolveDenaliDraftMerge(
  mode: DenaliDraftUnificationV3Mode,
):
  | ((local: DenaliMergeEnvelope, server: DenaliMergeEnvelope) => DenaliMergeEnvelope)
  | undefined {
  if (isDenaliDraftUnificationV3ServerWins(mode)) {
    return undefined;
  }
  const plugin = getDenaliWorkspacePlugin();
  return (local, server) => mergeDenaliDraftViaPlugin(plugin, local, server);
}
