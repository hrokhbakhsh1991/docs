/**
 * Case read-port barrel — re-exported via `@app-tour/finance-core/case` (PR4.5-B).
 */

export type {
  CaseFactProviderFailureReason,
  CaseFactProviderResult,
  CaseFactReadScope,
} from "./case-fact-read-scope";

export type { CaseObligationFactPort } from "./case-obligation-fact.port";
export type { CasePaymentFactBundle, CasePaymentFactPort } from "./case-payment-fact.port";
export type { CaseEvidenceFactPort } from "./case-evidence-fact.port";
export type {
  CaseLifecycleFactBundle,
  CaseLifecycleFactPort,
} from "./case-lifecycle-fact.port";
export type { CaseLedgerFactPort } from "./case-ledger-fact.port";
export type { CaseSignalFactBundle, CaseSignalFactPort } from "./case-signal-fact.port";
export { assembleFactSnapshot } from "./assemble-fact-snapshot";
export type { AssembledCaseFactInput } from "./assemble-fact-snapshot";
export {
  unknownAuditCues,
  unknownEligibilityFacts,
  unknownEvidenceFacts,
  unknownExceptionCues,
  unknownIntentFacts,
  unknownLifecycleBundle,
  unknownMoneyFacts,
  unknownPaymentBundle,
  unknownSettlementFacts,
  unknownSignalBundle,
} from "./unknown-fact-groups";
