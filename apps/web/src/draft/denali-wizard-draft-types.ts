import type { WorkspaceWizardDraftEnvelope } from "@app-tour/workspace-sdk";

import type { TourWizardDraft } from "@/tours/tour-wizard-draft";

/** Web operator UI envelope for Denali create/edit wizard drafts. */
export type NewTourWizardDraftEnvelope = WorkspaceWizardDraftEnvelope<TourWizardDraft>;
