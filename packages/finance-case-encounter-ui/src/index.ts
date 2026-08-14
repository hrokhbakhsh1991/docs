/**
 * @app-tour/finance-case-encounter-ui — PR8-B read-only EncounterView shell.
 * Presentation only. No commands, mutations, or financial interpretation.
 */

export type {
  CaseEncounterPresentationEnvelope,
  CaseEncounterViewContract,
  CaseLaneContract,
  CaseOwnerContract,
  CasePostureContract,
  CaseReadingContract,
  CaseSubjectKindContract,
  CompletenessClassContract,
  ConfidencePresentationContract,
  DiscoveryAttentionContract,
  EncounterCompletenessContract,
  EncounterExplainabilityContract,
  EncounterSurfaceStateContract,
} from "./contract";

export type {
  CaseCommandActionTokenContract,
  CaseCommandCapabilityContract,
} from "./command-capability";

export {
  deriveCaseCommandCapability,
  isReviewReceiptActionAvailable,
} from "./command-capability";

export {
  DEFAULT_CASE_ENCOUNTER_LABELS,
  type CaseEncounterLabelBundle,
} from "./labels";

export {
  CaseEncounterReadOnlyScreen,
  type CaseEncounterReadOnlyScreenProps,
} from "./case-encounter-read-only-screen";

export {
  CaseEncounterReadOnlyHost,
  type CaseEncounterHostLifecycleEvent,
  type CaseEncounterReadOnlyHostProps,
  type LoadCaseEncounter,
} from "./case-encounter-read-only-host";

export {
  fixtureEnrollmentEncounter,
  fixtureMarketplaceBuyerEncounter,
  fixtureSubscriptionEncounter,
} from "./fixtures";
