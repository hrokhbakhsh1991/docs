/**
 * Host Finance Case Command Bridge — reviewReceipt (PR9-B + PR14-A + PR14-B).
 */

export {
  authorizeCaseCommand,
  CaseCommandAuthzDeniedError,
  type CaseCommandAuthorizer,
} from "./authorize-case-command";
export {
  assertReviewReceiptVocabulary,
  CaseCommandVocabularyRejectedError,
  vocabularyAllows,
} from "./vocabulary-gate";
export {
  CaseCommandIntentInvalidError,
  mapReviewReceiptIntent,
  type MappedReviewReceiptCommand,
} from "./map-review-receipt";
export {
  encounterFromCaseOutput,
  loadEnrollmentCaseEncounter,
  type LoadEnrollmentCaseEncounterInput,
} from "./load-enrollment-encounter";
export {
  runReviewReceiptCommandBridge,
  type ReviewReceiptCommandPort,
  type RunReviewReceiptCommandBridgeDeps,
} from "./run-review-receipt-bridge";
export {
  createReviewReceiptCommandBridge,
  type CreateReviewReceiptBridgeInput,
} from "./create-review-receipt-bridge";
export type {
  CaseCommandIntent,
  CaseCommandName,
  CaseCommandReviewReceiptAction,
  CaseCommandReviewReceiptPayload,
  CaseCommandSourceEncounter,
  CaseCommandWorkspaceContext,
  ForbiddenCaseCommandMutation,
  ReviewReceiptActionToken,
  ReviewReceiptDecision,
} from "./case-command-intent";
export { FORBIDDEN_CASE_COMMAND_MUTATIONS } from "./case-command-intent";
export type { CaseCommandBridgeFailureCode } from "./command-bridge-failures";
export {
  CASE_COMMAND_BRIDGE_FAILURE_CODES,
  normalizeBridgeFailureReason,
} from "./command-bridge-failures";
export {
  assertIntentNotStale,
  caseOutputMeaningFingerprint,
  CaseCommandConcurrencyConflictError,
  isIntentStale,
} from "./stale-intent-guard";
export {
  mapCaseCommandIntent,
  toReviewReceiptBridgeIntent,
  type ReviewReceiptSoTPort,
} from "./map-case-command-intent";
export {
  createFinanceServiceReviewReceiptAdapter,
  type FinanceReviewReceiptService,
} from "./finance-service-review-receipt-adapter";
export { mapBridgeResultToHttp } from "./map-bridge-result-to-http";
export {
  runFinanceCaseCommandReviewReceiptHttp,
  type RunFinanceCaseCommandReviewReceiptHttpInput,
} from "./run-finance-case-command-review-receipt-http";
export {
  createInMemoryCaseCommandTelemetrySink,
  getCaseCommandTelemetrySink,
  safeEmitCaseCommandTelemetry,
  setCaseCommandTelemetrySink,
  type CaseCommandTelemetryEvent,
  type CaseCommandTelemetryEventName,
  type CaseCommandTelemetrySink,
} from "./command-bridge-telemetry";
export type {
  CaseEncounterLoadResult,
  ReviewReceiptBridgeErr,
  ReviewReceiptBridgeIntent,
  ReviewReceiptBridgeOk,
  ReviewReceiptBridgeResult,
  ReviewReceiptSotResult,
} from "./types";
