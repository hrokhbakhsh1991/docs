import { getDenaliWorkspacePlugin } from "@app-tour/workspace-denali/plugin";
import {
  buildDenaliCreatePrefilledForm as buildDenaliCreatePrefilledFormCore,
} from "@app-tour/workspace-denali/ui/chrome/draft-binding";

import type { NewTourWizardDraftEnvelope } from "@/draft/denali-wizard-draft-types";
import {
  createDenaliDraftOnPushSuccess,
  resolveDenaliDraftConflictStrategy,
} from "@/draft/draft-unification-v3-options";
import { emptyDenaliTourWizardDraft as emptyTourWizardDraft } from "@app-tour/workspace-denali/draft/tour-wizard";
import { applyDenaliDefaultTourKind } from "@app-tour/workspace-denali/ui/logic/denali-default-tour-kind";

import type { WizardTemplateGateState } from "@/tours/wizard-template-gate-logic";
import { applyWizardTemplatePrefillToDraft } from "@/tours/wizard-template-prefill-logic";

export {
  createDenaliWizardDraftSessionId,
  DENALI_CREATE_TOUR_DRAFT_KEY,
  DENALI_OPERATOR_WIZARD_DRAFT_NAMESPACE,
  createDenaliDraftSchemaGate,
  denaliHydrateDraftEnvelope,
  denaliPrepareDraftEnvelope,
  isDenaliFreshStartEnvelope,
  resolveDenaliDraftMerge,
  type DenaliWizardDraftMeta,
} from "@app-tour/workspace-denali/draft";

export type { NewTourWizardDraftEnvelope };

export {
  createDenaliDraftOnPushSuccess,
  resolveDenaliDraftConflictStrategy,
} from "@/draft/draft-unification-v3-options";

export { applyDenaliDefaultTourKind };

/** Shell-only template prefill wiring for Denali create wizard drafts. */
export function buildDenaliCreatePrefilledForm(
  gate: WizardTemplateGateState
): ReturnType<typeof emptyTourWizardDraft> {
  return buildDenaliCreatePrefilledFormCore(gate, (draft, prefillGate) =>
    applyWizardTemplatePrefillToDraft(
      draft,
      prefillGate.seedLabel,
      prefillGate.fieldOverlays,
      "denali",
      getDenaliWorkspacePlugin()
    )
  );
}
