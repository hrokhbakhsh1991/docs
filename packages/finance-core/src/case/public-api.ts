/**
 * Curated Case public surface — `@app-tour/finance-core/case` (PR4.5-B).
 *
 * Allowed: execution, shadow, ports, portable facts, CaseOutput types, assembler.
 * Forbidden: rules/* internals, Denali/adapters, Prisma, Case persistence.
 */

export type {
  AbsentFact,
  AmountMinorFact,
  KnownFact,
  PresenceFact,
  TriFact,
  UnknownFact,
} from "./facts/fact-tokens";
export {
  absentFact,
  isAbsent,
  isKnown,
  isKnownPositiveMinor,
  isKnownZeroMinor,
  isUnknown,
  knownFact,
  unknownFact,
} from "./facts/fact-tokens";

export type {
  AuditCueFacts,
  CaseFacts,
  CaseSubjectKind,
  CollectionPolicy,
  EligibilityFacts,
  EvidenceFacts,
  EvidenceSource,
  ExceptionCueFacts,
  IdentityFacts,
  IntentFacts,
  IntentKind,
  IntentSet,
  LifecycleEligibility,
  MoneyFacts,
  ProofProgress,
  ScheduleKind,
  SettlementFacts,
  SettlementMeaning,
} from "./facts/fact-groups";

export type {
  EncounterAttention,
  EncounterMetadata,
  EncounterMode,
  FactSnapshot,
} from "./snapshot/fact-snapshot";

export type {
  CaseAllowAction,
  CaseForbidAction,
  CaseLane,
  CaseOutput,
  CaseOwner,
  CasePosture,
  CaseReading,
  CompletenessClass,
  ConfidenceQuartet,
} from "./output/case-output";

/** Pure interpreter — host normally prefers executeFinanceCase. */
export { interpretFinanceCase } from "./interpret/interpret-finance-case";

export type {
  AssembledCaseFactInput,
  CaseEvidenceFactPort,
  CaseFactProviderFailureReason,
  CaseFactProviderResult,
  CaseFactReadScope,
  CaseLedgerFactPort,
  CaseLifecycleFactBundle,
  CaseLifecycleFactPort,
  CaseObligationFactPort,
  CasePaymentFactBundle,
  CasePaymentFactPort,
  CaseSignalFactBundle,
  CaseSignalFactPort,
} from "./ports/index";
export { assembleFactSnapshot } from "./ports/index";
export {
  unknownAuditCues,
  unknownEvidenceFacts,
  unknownLifecycleBundle,
  unknownMoneyFacts,
  unknownPaymentBundle,
  unknownSignalBundle,
} from "./ports/index";

export {
  assembleCaseFactSnapshot,
  type AssembleCaseFactSnapshotRequest,
  type AssembleCaseFactSnapshotResult,
  type CaseFactAssemblerProviders,
  type ProviderInvocationStatus,
} from "./assemble/index";

export {
  executeFinanceCase,
  type CaseExecutionDiagnostics,
  type CaseExecutionRequest,
  type ExecuteFinanceCaseResult,
} from "./execute/index";

export {
  runShadowFinanceCase,
  type ShadowExecutionRequest,
  type ShadowExecutionResult,
  type ShadowObservationSink,
} from "./shadow/index";

export {
  projectCaseEncounter,
  type CaseEncounterCompletenessIndicator,
  type CaseEncounterConfidencePresentation,
  type CaseEncounterExplainability,
  type CaseEncounterView,
  type ProjectCaseEncounterOptions,
} from "./encounter/index";
