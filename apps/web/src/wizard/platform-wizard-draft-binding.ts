import type { WorkspaceWizardDraftEnvelope, WorkspaceWizardDraftMeta } from "@app-tour/workspace-sdk";

import type { TourWizardDraft } from "@/tours/tour-wizard-draft";

/** Shared operator wizard draft namespace (starter / urban / platform create). */
export const PLATFORM_OPERATOR_WIZARD_DRAFT_NAMESPACE = "operator.wizard" as const;

export function platformCreateTourDraftKey(pluginId: string): string {
  return `${pluginId}-create`;
}

export type PlatformCreateTourDraftEnvelope = WorkspaceWizardDraftEnvelope<TourWizardDraft>;

export function createPlatformWizardDraftEnvelope(
  form: TourWizardDraft,
  meta: WorkspaceWizardDraftMeta
): PlatformCreateTourDraftEnvelope {
  return Object.freeze({ form, meta });
}
