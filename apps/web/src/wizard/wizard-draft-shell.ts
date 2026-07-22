/**
 * Thin shell re-exports — draft shell via B.11 neutral aliases.
 * Branded binder symbols live in {@link ./draft-shell-runtime}.
 */
export {
  DEFAULT_WIZARD_PLUGIN_ID,
  createOperatorWizardDraftSessionId,
  OPERATOR_CREATE_TOUR_DRAFT_KEY,
  OPERATOR_WIZARD_DRAFT_NAMESPACE,
  createOperatorDraftSchemaGate,
  hydrateOperatorDraftEnvelope,
  prepareOperatorDraftEnvelope,
  isOperatorFreshStartEnvelope,
  resolveOperatorDraftMerge,
  applyDefaultTourKind,
  buildCreatePrefilledForm,
  type OperatorWizardDraftMeta,
} from "./draft-shell-runtime";

export type { NewTourWizardDraftEnvelope } from "@/draft/tour-wizard-draft-envelope";

export {
  createOperatorDraftOnPushSuccess,
  resolveOperatorDraftConflictStrategy,
} from "@/draft/draft-unification-v3-options";
