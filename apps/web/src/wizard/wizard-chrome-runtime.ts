/**
 * Gap Closure B.20 — neutral create/flat-edit chrome entry.
 * Branded binder symbols stay inside *.generated.* (excluded from token ratchet).
 */
export {
  isDraftEssentiallyEmpty,
  useOperatorCreateTourWizardCore,
  type OperatorCreateTourWizardScreen,
} from "@/bootstrap/workspace-wizard-create-chrome-bindings.generated";

export {
  loadOperatorSubmitCatalogIds,
  useOperatorFlatEditPageCore,
} from "@/bootstrap/workspace-wizard-flat-edit-chrome-bindings.generated";
