import {
  applyDenaliDefaultTourKind,
  buildDenaliCreatePrefilledFormCore,
  createDenaliDraftSchemaGate,
  createDenaliWizardDraftSessionId,
  DENALI_CREATE_TOUR_DRAFT_KEY,
  DENALI_OPERATOR_WIZARD_DRAFT_NAMESPACE,
  denaliHydrateDraftEnvelope,
  denaliPrepareDraftEnvelope,
  getDenaliWorkspacePluginFromDraftShell,
  isDenaliFreshStartEnvelope,
  resolveDenaliDraftMerge,
  type DenaliWizardDraftMeta,
} from "@/bootstrap/workspace-wizard-draft-shell-bindings.generated";
import type { WizardTemplateGateState } from "@/tours/wizard-template-gate-logic";
import type { WizardTemplateFieldRef } from "@/features/settings/wizard-template-types";
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
};

export type { NewTourWizardDraftEnvelope } from "@/draft/denali-wizard-draft-types";

export {
  createDenaliDraftOnPushSuccess,
  resolveDenaliDraftConflictStrategy,
} from "@/draft/draft-unification-v3-options";

export { applyDenaliDefaultTourKind };

/** Shell-only template prefill wiring for Denali create wizard drafts. */
export function buildDenaliCreatePrefilledForm(
  gate: WizardTemplateGateState
): ReturnType<typeof buildDenaliCreatePrefilledFormCore> {
  return buildDenaliCreatePrefilledFormCore(gate, (draft, prefillGate) =>
    applyWizardTemplatePrefillToDraft(
      draft,
      prefillGate.seedLabel,
      prefillGate.fieldOverlays as ReadonlyMap<string, WizardTemplateFieldRef>,
      "denali",
      getDenaliWorkspacePluginFromDraftShell()
    )
  );
}
