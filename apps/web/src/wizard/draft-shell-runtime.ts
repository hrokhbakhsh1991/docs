/**
 * Gap Closure B.20 — neutral draft-shell entry.
 * Branded binder symbols stay inside *.generated.* (excluded from token ratchet).
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
  getWorkspacePluginFromDraftShell,
  type OperatorWizardDraftMeta,
} from "@/bootstrap/workspace-wizard-draft-shell-bindings.generated";
