/**
 * Host Finance Case DI + shadow + comparison (PR4.5-B/C / PR5-A / PR5-B).
 * Consumption via `@app-tour/finance-core/case` only — no deep imports.
 */

export {
  FINANCE_CASE_SHADOW_ENV,
  FINANCE_CASE_SHADOW_SAMPLE_RATE_ENV,
  FINANCE_CASE_SHADOW_SKIP_COMPARISON_READS_ENV,
  FINANCE_CASE_SHADOW_TENANTS_ENV,
  FINANCE_CASE_SHADOW_TRIGGERS_ENV,
  isFinanceCaseShadowEnabled,
  isFinanceCaseShadowSkipComparisonReads,
  parseFinanceCaseShadowSampleRate,
  parseFinanceCaseShadowTenantAllowlist,
  parseFinanceCaseShadowTriggerAllowlist,
  resolveFinanceCaseShadowRollout,
  type FinanceCaseShadowRolloutDecision,
  type ResolveFinanceCaseShadowRolloutInput,
} from "./finance-case-feature-flag";
export {
  createDenaliCaseFactProviders,
  type CreateDenaliCaseFactProvidersOptions,
} from "./create-denali-case-providers";
export {
  composeDenaliCaseFactProviders,
  FINANCE_CASE_PAYMENT_MODE_ENV,
  FINANCE_CASE_RECONCILIATION_ENABLED_ENV,
  resolveDenaliCaseCapabilityFromEnv,
  type ComposeDenaliCaseFactProvidersInput,
  type DenaliCaseCapabilityConfig,
} from "./compose-denali-case-providers";
export {
  invokeFinanceCaseShadow,
  scheduleFinanceCaseShadow,
  type FinanceCaseShadowSkipped,
  type InvokeFinanceCaseShadowInput,
  type InvokeFinanceCaseShadowResult,
} from "./invoke-finance-case-shadow";
export {
  HostDenaliCaseReadSource,
  buildEnrollmentCaseKey,
  buildEnrollmentCaseScope,
  type HostDenaliCaseReadDeps,
  type HostDenaliCaseReadFinancePort,
} from "./host-denali-case-read-source";
export {
  createFinanceCaseObservationSink,
  createInMemoryFinanceCaseObservationEmitter,
  type FinanceCaseMismatchClass,
  type FinanceCaseObservationEmitter,
  type FinanceCaseObservationRecord,
} from "./finance-case-observation-sink";
export {
  createLiveDenaliCaseProvidersForTenant,
  runDenaliFinanceCaseShadow,
  scheduleDenaliFinanceCaseShadow,
  type DenaliFinanceCaseShadowTrigger,
  type RunDenaliFinanceCaseShadowResult,
  type ScheduleDenaliFinanceCaseShadowInput,
} from "./schedule-denali-finance-case-shadow";
export {
  wrapFinanceServiceWithCaseShadow,
  type FinanceCaseShadowWrapDeps,
  type FinanceCaseShadowWrapFinancePort,
} from "./wrap-finance-service-case-shadow";
export {
  attachListPaymentsForRegistration,
  listPaymentsForRegistration,
} from "./list-payments-for-registration";
export {
  classifyOperationalObservation,
  compareFinanceCaseObservation,
  createInMemoryFinanceCaseComparisonEmitter,
  loadOperationalObservation,
  projectInterpreterClassification,
  type FinanceCaseComparisonCategory,
  type FinanceCaseComparisonEmitter,
  type FinanceCaseComparisonObservation,
  type FinanceCaseComparisonResult,
  type InterpreterClassification,
  type OperationalObservation,
} from "./comparison/index";
export {
  assertObservationMetricsHaveNoPersistenceConcepts,
  buildFactCoverageReport,
  calibrateMismatch,
  createProductionObservationSink,
  DEFAULT_FINANCE_CASE_QUALITY_GATE_THRESHOLDS,
  evaluateFinanceCaseQualityGates,
  type FactCoverageReport,
  type FinanceCaseQualityGateReport,
  type MismatchCalibrationClass,
  type ProductionObservationMetrics,
  type ProductionObservationSink,
} from "./observation/index";
export {
  authorizeCaseCommand,
  assertIntentNotStale,
  assertReviewReceiptVocabulary,
  caseOutputMeaningFingerprint,
  createReviewReceiptCommandBridge,
  FORBIDDEN_CASE_COMMAND_MUTATIONS,
  mapCaseCommandIntent,
  mapReviewReceiptIntent,
  runFinanceCaseCommandReviewReceiptHttp,
  runReviewReceiptCommandBridge,
  toReviewReceiptBridgeIntent,
  vocabularyAllows,
  type CaseCommandIntent,
  type ReviewReceiptBridgeIntent,
  type ReviewReceiptBridgeResult,
  type ReviewReceiptCommandPort,
  type ReviewReceiptSoTPort,
} from "./command-bridge/index";
export {
  createDenaliCaseFactProvidersWithPaymentCapability,
  createInMemoryGatewayObservationSink,
  InMemoryPaymentGateway,
  ingestGatewayWebhookEvent,
  ManualPaymentCaseFactProvider,
  OnlineGatewayEvidenceCaseFactProvider,
  OnlineGatewayPaymentCaseFactProvider,
  OnlinePaymentCaseFactProvider,
  selectPaymentCaseFactProvider,
  StripeGatewayAdapter,
  type FakeOnlineGatewayPaymentSnapshot,
  type GatewayObservationSink,
  type GatewayPaymentRecord,
  type PaymentCapabilityMode,
  type PaymentGatewayPort,
} from "./payment-capability/index";
export {
  classifyPaymentReconciliation,
  createDenaliCaseFactProvidersWithReconciliation,
  emitPortableReconCues,
  HostReconciliationSession,
  type HostReconClassification,
  type PortableReconCue,
  type ReconFindingCode,
  type ReconciliationComposeInput,
} from "./reconciliation/index";
export {
  authorizeCaseEncounterView,
  handleFinanceCaseEncounterGet,
  loadDenaliCaseEncounterPresentation,
  loadFinanceCaseEncounterHttp,
  toCaseEncounterPresentation,
  type CaseEncounterPresentation,
  type CaseEncounterPresentationResponse,
} from "./encounter/index";
export {
  buildFinanceCaseShadowReport,
  buildFinanceCaseShadowValidationReport,
  mapShadowMismatchTaxonomy,
  resolveFinanceCaseShadowDecision,
  SHADOW_DECISION_DEFERRED,
  type FinanceCaseShadowDecision,
  type FinanceCaseShadowDecisionKind,
  type FinanceCaseShadowReport,
  type FinanceCaseShadowValidationReport,
  type ShadowMismatchTaxonomyCode,
} from "./shadow/index";
