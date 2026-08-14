/**
 * Host Case Encounter production wiring (PR12-A) + hardening (PR12-B) + readiness (PR12-C).
 * Presentation only — no Case persistence / mutation chrome.
 */

export type {
  CaseEncounterPresentation,
  CaseEncounterPresentationResponse,
} from "./case-encounter-presentation";
export {
  authorizeCaseEncounterView,
  CaseEncounterViewAuthzDeniedError,
  type CaseEncounterViewAuthorizer,
} from "./authorize-case-encounter-view";
export {
  assertPresentationBoundary,
  toCaseEncounterPresentation,
} from "./to-case-encounter-presentation";
export {
  CaseEncounterNotFoundError,
  loadDenaliCaseEncounterPresentation,
  type LoadDenaliCaseEncounterPresentationInput,
} from "./load-denali-case-encounter-presentation";
export { buildLiveDenaliCaseReadDepsForTenant } from "./build-live-denali-case-read-deps";
export { handleFinanceCaseEncounterGet } from "./http-handler";
export {
  loadFinanceCaseEncounterHttp,
  type LoadFinanceCaseEncounterHttpInput,
} from "./load-finance-case-encounter-http";
export {
  FINANCE_CASE_ENCOUNTER_ENABLED_ENV,
  FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS_ENV,
  FINANCE_CASE_ENCOUNTER_MODE_ENV,
  FINANCE_CASE_ENCOUNTER_PILOT_TENANTS_ENV,
  FINANCE_CASE_ENCOUNTER_SAMPLE_RATE_ENV,
  FINANCE_CASE_ENCOUNTER_TENANTS_ENV,
  isFinanceCaseEncounterEnabled,
  parseFinanceCaseEncounterPilotTenantAllowlist,
  resolveFinanceCaseEncounterRollout,
  resolveFinanceCaseEncounterRolloutMode,
  type FinanceCaseEncounterRolloutDecision,
  type FinanceCaseEncounterRolloutMode,
} from "./finance-case-encounter-rollout";
export {
  ENCOUNTER_PILOT_ENV_KEYS,
  isPilotTenant,
  resolveEncounterPilotRolloutConfig,
  type EncounterPilotRolloutConfig,
} from "./encounter-pilot-config";
export {
  ENCOUNTER_INTERNAL_ENV_KEYS,
  isInternalTenant,
  resolveEncounterInternalRolloutConfig,
  type EncounterInternalRolloutConfig,
} from "./encounter-internal-config";
export {
  buildEncounterInternalRolloutHealthReport,
  summarizeEncounterMeaningSamples,
  summarizeProviderDegradationEvents,
  type EncounterInternalRolloutHealthReport,
  type EncounterVerdictSample,
} from "./encounter-internal-rollout-health";
export type {
  ClassicVsMeaningDisagreementSample,
  CommercialMeaningClientEvent,
  CommercialMeaningClientEventName,
} from "./commercial-meaning-client-events";
export {
  calibrateCommercialMeaningFeedback,
  type CommercialMeaningCalibrationClass,
  type CommercialMeaningFeedbackCalibration,
} from "./commercial-meaning-feedback-calibration";
export {
  recommendCommercialMeaningRollout,
  type CommercialMeaningRolloutRecommendation,
  type CommercialMeaningRolloutRecommendationKind,
} from "./commercial-meaning-rollout-recommendation";
export {
  buildCommercialMeaningInternalHealthReport,
  summarizeCommercialMeaningClientFeedback,
  type CommercialMeaningInternalHealthReport,
} from "./commercial-meaning-rollout-health";
export {
  FINANCE_CASE_ENCOUNTER_EMERGENCY_DISABLE_ENV,
  FINANCE_CASE_ENCOUNTER_HEALTH_HOLD_ENV,
  resolveEncounterProductionDecision,
  type EncounterProductionDecision,
  type EncounterProductionDecisionReason,
} from "./encounter-production-decision";
export {
  recommendEncounterRollout,
  type EncounterRolloutRecommendation,
  type EncounterRolloutRecommendationKind,
} from "./encounter-rollout-recommendation";
export {
  deriveEncounterSurfaceState,
  type EncounterOperatorSurfaceState,
  type EncounterPresentationSurfaceState,
} from "./derive-encounter-surface-state";
export {
  configureEncounterTelemetrySink,
  createInMemoryEncounterTelemetrySink,
  getEncounterTelemetrySink,
  safeEmitEncounterTelemetry,
  type EncounterOperatorFeedbackEvent,
  type EncounterTelemetryEvent,
  type EncounterTelemetrySink,
} from "./encounter-telemetry";
export {
  buildProviderDegradationTelemetryEvent,
  isOptionalEncounterProvider,
  listProviderDegradationTelemetryEvents,
  normalizeProviderDegradationReason,
  type EncounterProviderName,
} from "./provider-degradation-telemetry";
export {
  createEncounterProductionTelemetrySink,
  type EncounterProductionEmitter,
} from "./encounter-production-emitter";
export {
  evaluateEncounterRolloutHealth,
  type EncounterRolloutHealthReport,
} from "./encounter-rollout-health";
export {
  buildEncounterObservationWindow,
  buildEncounterRolloutReport,
  type EncounterObservationWindow,
  type EncounterRolloutReport,
  type EncounterRolloutRiskIndicator,
} from "./encounter-rollout-report";
export {
  EncounterExecutionTimeoutError,
  resolveEncounterExecutionTimeoutMs,
  resolveEncounterGatewayTimeoutMs,
  withEncounterTimeout,
  FINANCE_CASE_ENCOUNTER_TIMEOUT_MS_ENV,
  FINANCE_CASE_ENCOUNTER_GATEWAY_TIMEOUT_MS_ENV,
} from "./encounter-execution-timeout";
export { withEncounterGatewayTimeout } from "./timeout-payment-gateway";
